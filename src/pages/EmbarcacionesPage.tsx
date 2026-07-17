import { useState, useEffect } from "react";
import { Ship, Anchor, Plus, CheckCircle2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import FormularioTripulante from "@/components/FormularioTripulante";
import { apiFetch } from "@/lib/apiClient"; 

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface EmbarcacionAPI {
  id_embarcacion: number;
  id_socio: number;
  nombres?: string;
  apellidos?: string;
  matricula: string;
  nombre_nave: string;
  tipo: string;
  eslora: number | string;
  estado_capitania: string;
}

interface SocioSimple {
  id_socio: number;
  nombres: string;
  apellidos: string;
}

interface RadaAPI {
  id: number;
  codigo: string;
  estado: string; // "Disponible", "Ocupado", "Mantenimiento"
  embarcacion: string | null;
}

// ---------------------------------------------------------------------------
// Helpers visuales
// ---------------------------------------------------------------------------
function CapitaniaBadge({ estado }: { estado: string }) {
  return estado === "Validado" ? (
    <Badge className="bg-green-100 text-green-800 border-green-200">Validado</Badge>
  ) : (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>
  );
}

function radaClasses(estado: string) {
  switch (estado) {
    case "Ocupado": return "bg-blue-900 border-blue-700 text-white cursor-pointer hover:bg-blue-800 transition-colors";
    case "Disponible": return "bg-teal-50 border-teal-300 text-teal-800 cursor-pointer hover:bg-teal-100 transition-colors";
    case "Mantenimiento": return "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed opacity-60";
    default: return "bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed opacity-60";
  }
}

const formVacio = {
  id_socio: "",
  matricula: "",
  nombre_nave: "",
  tipo: "",
  eslora: "",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function EmbarcacionesPage() {
  const { toast } = useToast();

  // ── Estados ───────────────────────────────────────────────────────────────
  const [embarcaciones, setEmbarcaciones] = useState<EmbarcacionAPI[]>([]);
  const [radas, setRadas] = useState<RadaAPI[]>([]);
  const [socios, setSocios] = useState<SocioSimple[]>([]);

  const [cargandoFlota, setCargandoFlota] = useState(true);
  const [errorFlota, setErrorFlota] = useState<string | null>(null);

  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Modal de Radas
  const [radaDialog, setRadaDialog] = useState<{ radaId: number; modo: "asignar" | "liberar" } | null>(null);
  const [embSeleccionada, setEmbSeleccionada] = useState("");

  // ── Búsqueda y paginación tabla de Flota ─────────────────────────────────
  const [busquedaFlota, setBusquedaFlota] = useState("");
  const [paginaFlota, setPaginaFlota] = useState(1);
  const [porPaginaFlota, setPorPaginaFlota] = useState(10);

  // Embarcaciones disponibles para asignar (Validadas y que NO estén ya en una rada)
  const embSinRada = embarcaciones.filter((e) => {
    const estaValidada = e.estado_capitania === "Validado";
    const yaEstaEstacionada = radas.some((r) => r.embarcacion === e.nombre_nave);
    return estaValidada && !yaEstaEstacionada;
  });

  // ── Fetching de Datos ─────────────────────────────────────────────────────
  const fetchEmbarcaciones = async () => {
    setCargandoFlota(true);
    setErrorFlota(null);
    try {
      const res = await apiFetch("/api/nautica/embarcaciones");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar la flota.`);
      const data = await res.json();
      setEmbarcaciones(data);
    } catch (err) {
      setErrorFlota(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargandoFlota(false);
    }
  };

  const fetchRadas = async () => {
    try {
      const res = await apiFetch("/api/nautica/radas");
      if (!res.ok) return;
      const data = await res.json();
      setRadas(data);
    } catch { /* silencioso */ }
  };

  const fetchSocios = async () => {
    try {
      const res = await apiFetch("/api/socios");
      if (!res.ok) return;
      const data = await res.json();
      setSocios(data);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    fetchEmbarcaciones();
    fetchRadas();
    fetchSocios();
  }, []);

  // ── Validaciones en Tiempo Real ───────────────────────────────────────────
  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regexNombre = /^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]+[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ ]*$/;
    if (valor === "" || regexNombre.test(valor)) {
      setForm((prev) => ({ ...prev, nombre_nave: valor }));
    }
  };

  const handleEsloraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regexEslora = /^\d*\.?\d*$/;
    if (valor === "" || regexEslora.test(valor)) {
      setForm((prev) => ({ ...prev, eslora: valor }));
    }
  };

  const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toUpperCase();
    const regexMatricula = /^[A-Z0-9-]+$/;
    if (valor === "" || regexMatricula.test(valor)) {
      setForm((prev) => ({ ...prev, matricula: valor }));
    }
  };

  // ── CRUD Flota ────────────────────────────────────────────────────────────
  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id_socio) { setErrorForm("Selecciona un socio propietario."); return; }
    setEnviando(true);
    setErrorForm(null);
    try {
      const res = await apiFetch("/api/nautica/embarcaciones/crear", {
  method: "POST",
  body: JSON.stringify({
    id_socio: Number(form.id_socio),
    matricula: form.matricula,
    nombre_nave: form.nombre_nave,
    tipo: form.tipo,
    eslora: parseFloat(form.eslora) || form.eslora,
  }),
});
  
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 201) {
        toast({ title: "Embarcación registrada", description: `${form.nombre_nave} agregada con validación pendiente.` });
        setForm(formVacio);
        setOpenNew(false);
        await fetchEmbarcaciones();
      } else {
        setErrorForm(data.mensaje ?? `Error al registrar.`);
      }
    } catch {
      setErrorForm("Error de red. Verifica tu conexión.");
    } finally {
      setEnviando(false);
    }
  };

  const handleValidar = async (id: number, nombre: string) => {
    try {
      const res = await apiFetch(`/api/nautica/embarcaciones/${id}/validar`, {
  method: "PUT",
});
      if (res.ok || res.status === 200) {
        setEmbarcaciones((prev) => prev.map((e) => e.id_embarcacion === id ? { ...e, estado_capitania: "Validado" } : e));
        toast({ title: "Capitanía validada", description: `${nombre} ha sido validada y ya puede usar una rada.` });
      } else {
        toast({ title: "Error", description: "No se pudo validar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de red", description: "Sin conexión.", variant: "destructive" });
    }
  };

  // ── Lógica de Radas Reales ────────────────────────────────────────────────
  function handleRadaClick(radaId: number, estado: string) {
    if (estado === "Mantenimiento") return;
    setEmbSeleccionada("");
    setRadaDialog({ radaId, modo: estado === "Disponible" ? "asignar" : "liberar" });
  }

  const handleAsignar = async () => {
    if (!embSeleccionada || !radaDialog) return;
    try {
      const res = await apiFetch(`/api/nautica/radas/${radaDialog.radaId}/asignar`, {
  method: "PUT",
  body: JSON.stringify({ id_embarcacion: Number(embSeleccionada) }),
});
      if (res.ok) {
        toast({ title: "Rada asignada", description: "La embarcación ha sido estacionada correctamente." });
        setRadaDialog(null);
        await fetchRadas(); // Refrescar el mapa
      } else {
        toast({ title: "Error", description: "No se pudo asignar la rada.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión.", variant: "destructive" });
    }
  };

  const handleLiberar = async () => {
    if (!radaDialog) return;
    try {
      const res = await apiFetch(`/api/nautica/radas/${radaDialog.radaId}/liberar`, {
  method: "PUT",
});
      if (res.ok) {
        toast({ title: "Rada liberada", description: "El espacio de amarre vuelve a estar disponible." });
        setRadaDialog(null);
        await fetchRadas(); // Refrescar el mapa
      } else {
        toast({ title: "Error", description: "No se pudo liberar la rada.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión.", variant: "destructive" });
    }
  };

  // ── Filtrado y paginación de la tabla de Flota ───────────────────────────
  const embarcacionesFiltradas = embarcaciones.filter((e) => {
    const texto = busquedaFlota.trim().toLowerCase();
    if (!texto) return true;
    const propietario = e.nombres ? `${e.nombres} ${e.apellidos}` : `Socio #${e.id_socio}`;
    const campo = `${e.nombre_nave} ${e.matricula} ${propietario}`.toLowerCase();
    return campo.includes(texto);
  });

  const totalFlota = embarcacionesFiltradas.length;
  const totalPaginasFlota = Math.max(1, Math.ceil(totalFlota / porPaginaFlota));
  const paginaActualFlota = Math.min(paginaFlota, totalPaginasFlota);
  const inicioFlota = (paginaActualFlota - 1) * porPaginaFlota;
  const finFlota = Math.min(inicioFlota + porPaginaFlota, totalFlota);
  const flotaPaginada = embarcacionesFiltradas.slice(inicioFlota, finFlota);

  const handleBuscarFlota = (valor: string) => {
    setBusquedaFlota(valor);
    setPaginaFlota(1);
  };

  const handleCambiarPorPaginaFlota = (valor: string) => {
    setPorPaginaFlota(Number(valor));
    setPaginaFlota(1);
  };

  const numerosPaginaFlota = Array.from({ length: totalPaginasFlota }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPaginasFlota || Math.abs(n - paginaActualFlota) <= 1)
    .reduce<(number | "...")[]>((acc, n, idx, arr) => {
      if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(n);
      return acc;
    }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Embarcaciones y Radas</h1>
        <p className="text-muted-foreground text-sm">Control de naves, espacios de amarre y tripulación</p>
      </div>

      <Tabs defaultValue="embarcaciones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="embarcaciones" className="gap-2">
            <Ship className="h-4 w-4" /> Flota
          </TabsTrigger>
          <TabsTrigger value="radas" className="gap-2">
            <Anchor className="h-4 w-4" /> Radas
          </TabsTrigger>
          <TabsTrigger value="tripulantes" className="gap-2">
            Tripulantes
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: FLOTA ─────────────────────────────────────────────────── */}
        <TabsContent value="embarcaciones">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Gestión de Flota</CardTitle>
                <Dialog open={openNew} onOpenChange={(v) => { setOpenNew(v); if (!v) { setForm(formVacio); setErrorForm(null); } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2 bg-blue-900 text-white">
                      <Plus className="h-4 w-4" /> Nueva Embarcación
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Registrar Embarcación</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleRegistrar} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="emb-nombre">Nombre de la nave</Label>
                        <Input id="emb-nombre" placeholder="Ej: Neptuno II" value={form.nombre_nave} onChange={handleNombreChange} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="emb-matricula">Matrícula</Label>
                        <Input id="emb-matricula" placeholder="Ej: CO-59834-RE" value={form.matricula} onChange={handleMatriculaChange} required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="emb-tipo">Tipo</Label>
                          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                            <SelectTrigger id="emb-tipo"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Velero">Velero</SelectItem>
                              <SelectItem value="Lancha">Lancha</SelectItem>
                              <SelectItem value="Yate">Yate</SelectItem>
                              <SelectItem value="Catamarán">Catamarán</SelectItem>
                              <SelectItem value="Bote">Bote</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="emb-eslora">Eslora (m)</Label>
                          <Input id="emb-eslora" placeholder="Ej: 12.5" value={form.eslora} onChange={handleEsloraChange} required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="emb-socio">Socio Propietario</Label>
                        <Select value={form.id_socio} onValueChange={(v) => setForm({ ...form, id_socio: v })}>
                          <SelectTrigger id="emb-socio"><SelectValue placeholder="Seleccionar socio" /></SelectTrigger>
                          <SelectContent>
                            {socios.map((s) => (
                              <SelectItem key={s.id_socio} value={String(s.id_socio)}>
                                {s.nombres} {s.apellidos}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {errorForm && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
                          <p className="text-sm text-destructive font-medium">{errorForm}</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setOpenNew(false)} disabled={enviando}>Cancelar</Button>
                        <Button type="submit" disabled={enviando || !form.tipo} className="bg-blue-900 text-white">
                          {enviando ? "Registrando..." : "Registrar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Select value={String(porPaginaFlota)} onValueChange={handleCambiarPorPaginaFlota}>
                    <SelectTrigger className="w-[72px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>registros</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, matrícula o propietario..."
                    value={busquedaFlota}
                    onChange={(e) => handleBuscarFlota(e.target.value)}
                    className="pl-8 h-8 w-full sm:w-72"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Eslora</TableHead>
                    <TableHead>Propietario</TableHead>
                    <TableHead>Capitanía</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargandoFlota ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Cargando flota...</TableCell></TableRow>
                  ) : errorFlota ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-destructive py-10">{errorFlota}</TableCell></TableRow>
                  ) : embarcacionesFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        {busquedaFlota ? "No se encontraron embarcaciones con ese criterio de búsqueda." : "No hay embarcaciones registradas."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    flotaPaginada.map((e) => (
                      <TableRow key={e.id_embarcacion}>
                        <TableCell className="font-medium">{e.nombre_nave}</TableCell>
                        <TableCell className="text-muted-foreground font-mono">{e.matricula}</TableCell>
                        <TableCell className="text-muted-foreground">{e.tipo}</TableCell>
                        <TableCell className="text-muted-foreground">{e.eslora}m</TableCell>
                        <TableCell>{e.nombres ? `${e.nombres} ${e.apellidos}` : `Socio #${e.id_socio}`}</TableCell>
                        <TableCell><CapitaniaBadge estado={e.estado_capitania} /></TableCell>
                        <TableCell>
                          {e.estado_capitania === "Pendiente" && (
                            <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleValidar(e.id_embarcacion, e.nombre_nave)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Validar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalFlota > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 text-sm">
                  <p className="text-muted-foreground">
                    Mostrando registros del {inicioFlota + 1} al {finFlota} de un total de {totalFlota} registros
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={paginaActualFlota === 1}
                      onClick={() => setPaginaFlota((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    {numerosPaginaFlota.map((n, idx) =>
                      n === "..." ? (
                        <span key={`dots-${idx}`} className="px-2 text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={n}
                          variant={n === paginaActualFlota ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPaginaFlota(n as number)}
                        >
                          {n}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={paginaActualFlota === totalPaginasFlota}
                      onClick={() => setPaginaFlota((p) => Math.min(totalPaginasFlota, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: RADAS ─────────────────────────────────────────────────── */}
        <TabsContent value="radas">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mapa de Espacios de Amarre</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Haz clic en una rada disponible para asignar una nave, o en una ocupada para liberarla.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {radas.length > 0 ? radas.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-4 text-center space-y-1 ${radaClasses(r.estado)}`}
                    onClick={() => handleRadaClick(r.id, r.estado)}
                  >
                    <p className="font-bold text-sm">{r.codigo}</p>
                    <p className="text-xs font-medium">{r.estado}</p>
                    {r.embarcacion && <p className="text-xs opacity-80">{r.embarcacion}</p>}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground col-span-full py-4">No hay radas registradas en la base de datos.</p>
                )}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-200 border border-teal-300" /> Disponible</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-900" /> Ocupado</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" /> Mantenimiento</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: TRIPULANTES ───────────────────────────────────────────── */}
        <TabsContent value="tripulantes">
          <FormularioTripulante />
        </TabsContent>
      </Tabs>

      {/* ── Dialog Asignar / Liberar Rada ──────────────────────────────── */}
      <Dialog open={!!radaDialog} onOpenChange={(v) => { if (!v) setRadaDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{radaDialog?.modo === "asignar" ? "Asignar Embarcación" : "Liberar Rada"}</DialogTitle>
          </DialogHeader>
          {radaDialog?.modo === "asignar" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Embarcación sin rada</Label>
                <Select value={embSeleccionada} onValueChange={setEmbSeleccionada}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar nave validada" /></SelectTrigger>
                  <SelectContent>
                    {embSinRada.length > 0 ? (
                      embSinRada.map((e) => (
                        <SelectItem key={e.id_embarcacion} value={String(e.id_embarcacion)}>
                          {e.nombre_nave} ({e.tipo})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No hay naves validadas disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {embSinRada.length === 0 && (
                  <p className="text-xs text-yellow-600 mt-2">
                    * Solo las naves aprobadas por Capitanía que no tengan rada asignada aparecerán aquí.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRadaDialog(null)}>Cancelar</Button>
                <Button onClick={handleAsignar} disabled={!embSeleccionada || embSeleccionada === "none"} className="bg-blue-900 text-white">Asignar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">¿Confirmas liberar este espacio de amarre?</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRadaDialog(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleLiberar}>Liberar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}