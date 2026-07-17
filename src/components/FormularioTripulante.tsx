import { useState, useEffect, useMemo } from "react";
import { UserPlus, ShieldCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient"; 

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface TripulanteAPI {
  id_tripulante: number;
  nombres: string;
  apellidos: string;
  dni: string;
  tipo_doc_siglas?: string;
  rol: string;
  licencia: string | null;
  estado: string;
}

const ROLES = ["Capitán", "Patrón de Yate", "Marinero", "Motorista", "Personal de Servicio"] as const;

const formVacio = {
  nombres: "",
  apellidos: "",
  dni: "",
  rol: "",
  licencia: "",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function FormularioTripulante() {
  const { toast } = useToast();

  // Estados
  const [tripulantes, setTripulantes] = useState<TripulanteAPI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [idTipoDoc, setIdTipoDoc] = useState(1);

  // ── Estados de tabla: búsqueda y paginación ──────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [paginaActual, setPaginaActual] = useState(1);

  // ── Fetch Tripulantes ─────────────────────────────────────────────────────
  const fetchTripulantes = async () => {
  setCargando(true);
  try {
    const res = await apiFetch("/api/nautica/tripulantes");
    if (res.ok) {
      const data = await res.json();
      setTripulantes(data);
    }
  } catch (error) {
    console.error("Error al cargar tripulantes", error);
  } finally {
    setCargando(false);
  }
};
  useEffect(() => {
    fetchTripulantes();
  }, []);

  // ── Filtrado por búsqueda (nombre, apellido, documento, rol) ─────────────
  const tripulantesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return tripulantes;
    const termino = busqueda.trim().toLowerCase();
    return tripulantes.filter(
      (t) =>
        t.nombres.toLowerCase().includes(termino) ||
        t.apellidos.toLowerCase().includes(termino) ||
        t.dni.toLowerCase().includes(termino) ||
        t.rol.toLowerCase().includes(termino)
    );
  }, [tripulantes, busqueda]);

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPaginas = Math.max(1, Math.ceil(tripulantesFiltrados.length / registrosPorPagina));

  useEffect(() => {
    // Si al filtrar o cambiar el tamaño de página quedamos fuera de rango, volvemos a la página 1
    setPaginaActual(1);
  }, [busqueda, registrosPorPagina]);

  const tripulantesPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    return tripulantesFiltrados.slice(inicio, inicio + registrosPorPagina);
  }, [tripulantesFiltrados, paginaActual, registrosPorPagina]);

  const inicioRango = tripulantesFiltrados.length === 0 ? 0 : (paginaActual - 1) * registrosPorPagina + 1;
  const finRango = Math.min(paginaActual * registrosPorPagina, tripulantesFiltrados.length);

  // ── Manejadores con Validación en Tiempo Real ─────────────────────────────
  const handleNombresChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]*$/;
    if (valor === "" || regex.test(valor)) {
      setForm((prev) => ({ ...prev, nombres: valor }));
    }
  };

  const handleApellidosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]*$/;
    if (valor === "" || regex.test(valor)) {
      setForm((prev) => ({ ...prev, apellidos: valor }));
    }
  };

  const handleTipoDocChange = (v: string) => {
    setIdTipoDoc(Number(v));
    setForm((prev) => ({ ...prev, dni: "" }));
  };

  const handleDniChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (valor === "") {
      setForm((prev) => ({ ...prev, dni: "" }));
      return;
    }

    if (idTipoDoc === 1) {
      // DNI: solo números, máximo 8 caracteres
      if (/^\d+$/.test(valor) && valor.length <= 8) {
        setForm((prev) => ({ ...prev, dni: valor }));
      }
    } else if (idTipoDoc === 2) {
      // CE: solo números, máximo 9 caracteres
      if (/^\d+$/.test(valor) && valor.length <= 9) {
        setForm((prev) => ({ ...prev, dni: valor }));
      }
    } else if (idTipoDoc === 3) {
      // PAS: alfanumérico, sin espacios ni caracteres especiales, máximo 12 caracteres, letras en mayúsculas
      const valorUpper = valor.toUpperCase();
      if (/^[A-Z0-9]+$/.test(valorUpper) && valorUpper.length <= 12) {
        setForm((prev) => ({ ...prev, dni: valorUpper }));
      }
    }
  };

  const handleRolChange = (v: string) => {
    setForm((prev) => ({
      ...prev,
      rol: v,
      licencia: v === "Personal de Servicio" ? "" : prev.licencia,
    }));
  };

  const handleLicenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toUpperCase();
    const regex = /^[A-Z0-9-]+$/;
    if (valor === "" || regex.test(valor)) {
      setForm((prev) => ({ ...prev, licencia: valor }));
    }
  };

  // ── Registrar Tripulante ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.dni.trim() || !form.rol.trim()) {
      toast({ title: "Error", description: "Completa los campos obligatorios.", variant: "destructive" });
      return;
    }

    // Validar licencia obligatoria para ciertos roles (Capitán, Patrón de Yate, Marinero, Motorista)
    const rolesConLicenciaRequerida = ["Capitán", "Patrón de Yate", "Marinero", "Motorista"];
    if (rolesConLicenciaRequerida.includes(form.rol) && !form.licencia.trim()) {
      toast({ title: "Error", description: "La licencia es obligatoria para este rol.", variant: "destructive" });
      return;
    }

    setEnviando(true);
    try {
      const res = await apiFetch("/api/nautica/tripulantes/crear", {
  method: "POST",
  body: JSON.stringify({
    id_tipo_doc: idTipoDoc,
    nombres: form.nombres,
    apellidos: form.apellidos,
    dni: form.dni.trim().toUpperCase(),
    rol: form.rol,
    licencia: form.licencia || null,
  }),
});

      const data = await res.json().catch(() => ({}));

      if (res.ok || res.status === 201) {
        toast({ title: "Tripulante registrado", description: `${form.nombres} ha sido autorizado por el club.` });
        setForm(formVacio);
        setIdTipoDoc(1);
        fetchTripulantes();
      } else {
        toast({ title: "Error", description: data.mensaje || "Error al registrar.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error de red", description: "Revisa tu conexión.", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Formulario ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Registrar Personal de Navegación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Nombres *</Label>
              <Input placeholder="Ej: Carlos" value={form.nombres} onChange={handleNombresChange} required />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Apellidos *</Label>
              <Input placeholder="Ej: Mendoza" value={form.apellidos} onChange={handleApellidosChange} required />
            </div>

            {/* Tipo de documento */}
            <div className="space-y-1.5">
              <Label>Tipo de Doc.</Label>
              <Select value={String(idTipoDoc)} onValueChange={handleTipoDocChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">DNI</SelectItem>
                  <SelectItem value="2">CE</SelectItem>
                  <SelectItem value="3">PAS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Número de documento */}
            <div className="space-y-1.5">
              <Label>Número de Documento *</Label>
              <Input
                type="text"
                placeholder={idTipoDoc === 1 ? "Ej: 12345678" : idTipoDoc === 2 ? "Ej: 000123456" : "Ej: AB123456"}
                value={form.dni}
                onChange={handleDniChange}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label>Rol *</Label>
              <Select value={form.rol} onValueChange={handleRolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.rol !== "Personal de Servicio" && (
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Licencia *</Label>
                <Input placeholder="N° Carnet (Si aplica)" value={form.licencia} onChange={handleLicenciaChange} />
              </div>
            )}
            <div className="lg:col-span-4 flex justify-end">
              <Button type="submit" disabled={enviando || !form.rol} className="gap-2 bg-blue-900 text-white w-full sm:w-auto">
                <ShieldCheck className="h-4 w-4" />
                {enviando ? "Guardando..." : "Registrar y Autorizar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Tabla de tripulantes ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Tripulación Autorizada</CardTitle>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Selector de registros por página */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mostrar</span>
              <Select
                value={String(registrosPorPagina)}
                onValueChange={(v) => setRegistrosPorPagina(Number(v))}
              >
                <SelectTrigger className="w-[80px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>registros</span>
            </div>

            {/* Buscador */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, documento o rol"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-sm text-muted-foreground text-center py-6">Cargando registros...</p>
          ) : tripulantesFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {busqueda ? "No se encontraron resultados." : "No hay tripulantes registrados aún."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apellidos y Nombres</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Licencia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripulantesPagina.map((t) => (
                    <TableRow key={t.id_tripulante}>
                      <TableCell className="font-medium">{t.apellidos}, {t.nombres}</TableCell>
                      <TableCell className="font-medium text-xs">
                        <span className="text-muted-foreground mr-1">{t.tipo_doc_siglas || "DNI"}</span>
                        {t.dni}
                      </TableCell>
                      <TableCell>{t.rol}</TableCell>
                      <TableCell className="text-muted-foreground">{t.licencia || "—"}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          {t.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Info de rango + paginación */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando registros del {inicioRango} al {finRango} de un total de {tripulantesFiltrados.length} registros
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual === 1}
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                    <Button
                      key={num}
                      variant={num === paginaActual ? "default" : "outline"}
                      size="sm"
                      className={num === paginaActual ? "bg-blue-900 text-white" : ""}
                      onClick={() => setPaginaActual(num)}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual === totalPaginas}
                    onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
