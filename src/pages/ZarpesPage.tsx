import { useState, useEffect, useRef } from "react";
import { Plus, AlertTriangle, Navigation, CheckCircle, Printer, UserPlus, X, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient"; 
function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case "Aprobado":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Aprobado</Badge>;
    case "Rechazado":
      return <Badge className="bg-red-100 text-red-800 border-red-200">Rechazado</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
  }
}

export default function ZarpesPage() {
  const { toast } = useToast();

  const [zarpes, setZarpes] = useState<any[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [embarcaciones, setEmbarcaciones] = useState<any[]>([]);
  const [tripulantes, setTripulantes] = useState<any[]>([]);

  const [open, setOpen] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState("");
  const [selectedEmb, setSelectedEmb] = useState("");
  const [selectedTripulante, setSelectedTripulante] = useState("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [fechaRetorno, setFechaRetorno] = useState("");
  const [horaRetorno, setHoraRetorno] = useState("");
  const [destino, setDestino] = useState("");
  const [pasajeros, setPasajeros] = useState<{ nombre: string; documento: string }[]>([]);
  const [tempNombre, setTempNombre] = useState("");
  const [tempDoc, setTempDoc] = useState("");

  const [esMoroso, setEsMoroso] = useState(false);
  const [validandoSocio, setValidandoSocio] = useState(false);

  // Estado para el documento de zarpe a imprimir
  const [zarpeParaImprimir, setZarpeParaImprimir] = useState<any>(null);
  const [loadingPrint, setLoadingPrint] = useState<number | string | null>(null);

  // ── Búsqueda y paginación tabla de Zarpes ────────────────────────────────
  const [busquedaZarpes, setBusquedaZarpes] = useState("");
  const [paginaZarpes, setPaginaZarpes] = useState(1);
  const [porPaginaZarpes, setPorPaginaZarpes] = useState(10);

  

  const fetchZarpes = async () => {
    try {
      const res = await apiFetch("/api/nautica/zarpes");
      if (res.ok) {
        const data = await res.json();
        setZarpes(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchData = async () => {
    try {
      const [embsRes, tripRes, socRes] = await Promise.all([
  apiFetch("/api/nautica/embarcaciones"),
  apiFetch("/api/nautica/tripulantes"),
  apiFetch("/api/socios")
]);

      if (embsRes.ok) {
        const data = await embsRes.json();
        setEmbarcaciones(data.filter((e: any) => e.estado_capitania === 'Validado' || e.estado === 'Validado'));
      }
      if (tripRes.ok) {
        const data = await tripRes.json();
        setTripulantes(data.filter((t: any) => t.estado === 'Autorizado'));
      }
      if (socRes.ok) {
        const data = await socRes.json();
        setSocios(data);
      }
    } catch (error) {
      console.error("Error fetching form data:", error);
    }
  };

  useEffect(() => {
    fetchZarpes();
    fetchData();
  }, []);

  // useEffect para consultar la deudad del socio en tiempo real al backend
  useEffect(() => {
    if (!selectedSocio) {
      setEsMoroso(false);
      setValidandoSocio(false);
      return;
    }

    const validarDeudaSocio = async () => {
      setValidandoSocio(true);
      try {
        const res = await apiFetch(`/api/facturas/deuda/${selectedSocio}`);

        if (res.ok) {
          const data = await res.json();
          // Si la respuesta indica que tiene deudas (deudas_vencidas > 0, deuda > 0 o total_deuda > 0)
          const tieneDeuda = 
            (data.deudas_vencidas !== undefined && data.deudas_vencidas > 0) || 
            (data.total_deuda !== undefined && data.total_deuda > 0) ||
            (data.deuda !== undefined && data.deuda > 0) ||
            data.esMoroso === true ||
            data.estado === "Moroso";
          setEsMoroso(tieneDeuda);
        } else {
          // Fallback local en caso de que el endpoint no esté disponible
          const socioLocal = socios.find(s => String(s.id_socio || s.id) === String(selectedSocio));
          setEsMoroso(socioLocal?.estado === "Moroso");
        }
      } catch (error) {
        console.error("Error validando deuda de socio:", error);
        // Fallback local
        const socioLocal = socios.find(s => String(s.id_socio || s.id) === String(selectedSocio));
        setEsMoroso(socioLocal?.estado === "Moroso");
      } finally {
        setValidandoSocio(false);
      }
    };

    validarDeudaSocio();
  }, [selectedSocio, socios]);

  const resetForm = () => {
    setSelectedSocio("");
    setSelectedEmb("");
    setSelectedTripulante("");
    setFechaSalida("");
    setHoraSalida("");
    setFechaRetorno("");
    setHoraRetorno("");
    setDestino("");
    setPasajeros([]);
    setTempNombre("");
    setTempDoc("");
    setEsMoroso(false);
    setValidandoSocio(false);
  };

  const aprobarZarpe = async (id: number | string) => {
    try {
      const res = await apiFetch(`/api/nautica/zarpes/${id}/aprobar`, {
  method: "PUT",
});
      if (res.ok) {
        toast({ title: "Zarpe aprobado", description: "El estado ha sido actualizado correctamente." });
        fetchZarpes();
      } else {
        toast({ title: "Error", description: "No se pudo aprobar el zarpe.", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Ocurrió un problema de conexión.", variant: "destructive" });
    }
  };

  // Función para imprimir zarpe aprobado
  const handleImprimirZarpe = async (id: number | string) => {
    setLoadingPrint(id);
    try {
     const res = await apiFetch(`/api/nautica/zarpes/${id}/documento`);
      if (res.ok) {
        const data = await res.json();
        setZarpeParaImprimir(data);
        // Nombre dinámico del PDF + esperar render antes de imprimir
        setTimeout(() => {
          const originalTitle = document.title;
          const apellidosFormateados = (data.socio_apellidos || "").replace(/\s+/g, "_");
          document.title = `Permiso_Zarpe_${data.id_zarpe || id}_${apellidosFormateados}`;
          window.print();
          document.title = originalTitle;
        }, 400);
      } else {
        toast({ title: "Error", description: "No se pudo obtener el documento del zarpe.", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Ocurrió un problema al obtener el documento.", variant: "destructive" });
    } finally {
      setLoadingPrint(null);
    }
  };

  // ── Validaciones de Tipeo en Tiempo Real ──────────────────────────────────
  const handleDestinoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]*$/;
    if (valor === "" || regex.test(valor)) {
      setDestino(valor);
    }
  };

  const handleTempNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    const regex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ ]*$/;
    if (valor === "" || regex.test(valor)) {
      setTempNombre(valor);
    }
  };

  const handleTempDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toUpperCase();
    const regex = /^[A-Z0-9]+$/;
    if (valor === "" || regex.test(valor)) {
      setTempDoc(valor);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeZarpar) return;

    try {
      const body = {
        id_socio: selectedSocio,
        id_embarcacion: selectedEmb,
        id_tripulante: selectedTripulante,
        fecha_salida: fechaSalida,
        hora_salida: horaSalida,
        fecha_retorno: fechaRetorno,
        hora_retorno: horaRetorno,
        destino,
        pasajeros
      };

      // Nota: a diferencia de embarcaciones/tripulantes, la ruta de crear zarpe
      // en el backend NO tiene sufijo /crear: es un POST directo a /api/nautica/zarpes.
      const res = await apiFetch("/api/nautica/zarpes", {
  method: "POST",
  body: JSON.stringify(body)
});
      if (res.ok) {
        toast({ title: "Zarpe registrado", description: "El permiso de salida ha sido creado." });
        setOpen(false);
        resetForm();
        fetchZarpes();
      } else {
        toast({ title: "Error", description: "No se pudo registrar el zarpe.", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Ocurrió un problema al enviar los datos.", variant: "destructive" });
    }
  };

  const socioData = socios.find(s => String(s.id_socio) === String(selectedSocio) || String(s.id) === String(selectedSocio));
  const puedeZarpar = selectedSocio && selectedEmb && selectedTripulante && !esMoroso;

  // Embarcaciones validadas que pertenecen al socio seleccionado
  const embarcacionesDelSocio = selectedSocio
    ? embarcaciones.filter(
        (e) =>
          e.estado_capitania === "Validado" &&
          String(e.id_socio) === String(selectedSocio)
      )
    : [];

  // Helpers para formatear datos del documento
  const fmt = (d: any) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  };

  const zp = zarpeParaImprimir;
  // Mapeo directo con los alias planos que envía el backend
  const socioNombre = zp
    ? `${zp.socio_nombres || ""} ${zp.socio_apellidos || ""}`.trim()
    : "";
  const naveName = zp?.nombre_nave || "—";
  const naveMatricula = zp?.matricula || "—";
  const tripNombre = zp
    ? `${zp.tripulante_nombres || ""} ${zp.tripulante_apellidos || ""} ${zp.rol ? `- ${zp.rol}` : ""}`.trim()
    : "";
  const tripLicencia = zp?.licencia || "N/A";
  const fechaSalidaDoc = fmt(zp?.fecha_salida);
  const fechaRetornoDoc = fmt(zp?.fecha_retorno);
  const horaSalidaDoc = zp?.hora_salida || "—";
  const horaRetornoDoc = zp?.hora_retorno || "—";
  const destinoDoc = zp?.destino || "—";

  let pasajerosDoc = "Sin pasajeros adicionales (Solo tripulación oficial)";
  if (zp?.pasajeros) {
    try {
      const listaPasajeros = typeof zp.pasajeros === 'string' 
        ? JSON.parse(zp.pasajeros) 
        : zp.pasajeros;
        
      if (Array.isArray(listaPasajeros) && listaPasajeros.length > 0) {
        pasajerosDoc = listaPasajeros
          .map(p => `${p.nombre} (Doc: ${p.documento})`)
          .join("  •  ");
      }
    } catch (e) {
      console.error("Error leyendo lista de pasajeros:", e);
      pasajerosDoc = "Error al leer manifiesto";
    }
  }

  const idZarpeDoc = zp?.id_zarpe || zp?.id || "—";
  const fechaEmision = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

  // ── Filtrado y paginación de la tabla de Zarpes ──────────────────────────
  const zarpesFiltrados = zarpes.filter((z) => {
    const texto = busquedaZarpes.trim().toLowerCase();
    if (!texto) return true;
    const campo = `${z.socio_nombres || z.socio || ""} ${z.socio_apellidos || ""} ${z.embarcacion || ""}`.toLowerCase();
    return campo.includes(texto);
  });

  const totalZarpes = zarpesFiltrados.length;
  const totalPaginasZarpes = Math.max(1, Math.ceil(totalZarpes / porPaginaZarpes));
  const paginaActualZarpes = Math.min(paginaZarpes, totalPaginasZarpes);
  const inicioZarpes = (paginaActualZarpes - 1) * porPaginaZarpes;
  const finZarpes = Math.min(inicioZarpes + porPaginaZarpes, totalZarpes);
  const zarpesPaginados = zarpesFiltrados.slice(inicioZarpes, finZarpes);

  const handleBuscarZarpes = (valor: string) => {
    setBusquedaZarpes(valor);
    setPaginaZarpes(1);
  };

  const handleCambiarPorPaginaZarpes = (valor: string) => {
    setPorPaginaZarpes(Number(valor));
    setPaginaZarpes(1);
  };

  const numerosPaginaZarpes = Array.from({ length: totalPaginasZarpes }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPaginasZarpes || Math.abs(n - paginaActualZarpes) <= 1)
    .reduce<(number | "...")[]>((acc, n, idx, arr) => {
      if (idx > 0 && (n as number) - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zarpes</h1>
          <p className="text-muted-foreground text-sm">Control de permisos de salida</p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Zarpe
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Permiso de Salida</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Selector de socio */}
              <div className="space-y-1.5">
                <Label>Socio</Label>
                <Select value={selectedSocio} onValueChange={(v) => { setSelectedSocio(v); setSelectedEmb(""); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar socio" /></SelectTrigger>
                  <SelectContent>
                    {socios.map((s) => {
                      const id = String(s.id_socio || s.id);
                      return (
                        <SelectItem key={id} value={id}>
                          {s.nombres || s.nombre} {s.apellidos || ''} {s.estado === "Moroso" ? "⚠️" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {validandoSocio && (
                  <p className="text-xs text-muted-foreground animate-pulse mt-1">
                    Verificando estado financiero...
                  </p>
                )}
              </div>

              {/* Alert de estado financiero */}
              {selectedSocio && !validandoSocio && esMoroso && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Socio Bloqueado</AlertTitle>
                  <AlertDescription>
                    El socio mantiene deudas activas.
                  </AlertDescription>
                </Alert>
              )}

              {selectedSocio && !validandoSocio && !esMoroso && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Socio habilitado</AlertTitle>
                  <AlertDescription className="text-green-700">
                    El socio está al día y puede zarpar.
                  </AlertDescription>
                </Alert>
              )}

              {/* Selector de embarcación */}
              <div className="space-y-1.5">
                <Label>Embarcación</Label>
                <Select value={selectedEmb} onValueChange={setSelectedEmb} disabled={!selectedSocio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar embarcación validada" />
                  </SelectTrigger>
                  <SelectContent>
                    {embarcacionesDelSocio.length > 0 ? (
                      embarcacionesDelSocio.map((e) => {
                        const id = String(e.id_embarcacion);
                        return (
                          <SelectItem key={id} value={id}>
                            {e.nombre_nave} — {e.matricula}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {selectedSocio
                          ? "Este socio no tiene embarcaciones validadas."
                          : "Selecciona un socio primero."}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Tripulante */}
              <div className="space-y-1.5">
                <Label>Tripulante a cargo</Label>
                <Select value={selectedTripulante} onValueChange={setSelectedTripulante}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tripulante" /></SelectTrigger>
                  <SelectContent>
                    {tripulantes.map((t) => {
                      const id = String(t.id_tripulante || t.id);
                      return (
                        <SelectItem key={id} value={id}>
                          {t.nombre_apellido || (t.nombres ? `${t.nombres} ${t.apellidos || ''}` : t.nombre)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fecha de Salida</Label>
                  <Input type="date" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de Retorno</Label>
                  <Input type="date" value={fechaRetorno} onChange={(e) => setFechaRetorno(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Hora Salida</Label>
                  <Input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora Retorno</Label>
                  <Input type="time" value={horaRetorno} onChange={(e) => setHoraRetorno(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Input placeholder="Ej: Islas Palomino" value={destino} onChange={handleDestinoChange} required />
              </div>

              {/* Sección de Pasajeros */}
              <div className="space-y-2">
                <Label>Pasajeros</Label>

                {/* Fila de inputs + botón agregar */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre Completo"
                    value={tempNombre}
                    onChange={handleTempNombreChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (tempNombre.trim() && tempDoc.trim()) {
                          setPasajeros((prev) => [...prev, { nombre: tempNombre.trim(), documento: tempDoc.trim() }]);
                          setTempNombre("");
                          setTempDoc("");
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="DNI / CE / PAS"
                    value={tempDoc}
                    onChange={handleTempDocChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (tempNombre.trim() && tempDoc.trim()) {
                          setPasajeros((prev) => [...prev, { nombre: tempNombre.trim(), documento: tempDoc.trim() }]);
                          setTempNombre("");
                          setTempDoc("");
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (tempNombre.trim() && tempDoc.trim()) {
                        setPasajeros((prev) => [...prev, { nombre: tempNombre.trim(), documento: tempDoc.trim() }]);
                        setTempNombre("");
                        setTempDoc("");
                      }
                    }}
                    className="shrink-0 gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>

                {/* Lista de pasajeros agregados */}
                {pasajeros.length > 0 && (
                  <div className="rounded-md border bg-muted/40 divide-y divide-border">
                    {pasajeros.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{p.nombre}</span>
                          <Badge variant="secondary" className="shrink-0 text-xs font-mono">
                            {p.documento}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPasajeros((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-2 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Eliminar pasajero"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {pasajeros.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay pasajeros agregados aún.</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={validandoSocio || esMoroso || !puedeZarpar}>
                  {esMoroso ? "Bloqueado" : "Registrar Zarpe"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabla de zarpes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              Zarpes Programados
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select value={String(porPaginaZarpes)} onValueChange={handleCambiarPorPaginaZarpes}>
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
                  placeholder="Buscar por socio o embarcación..."
                  value={busquedaZarpes}
                  onChange={(e) => handleBuscarZarpes(e.target.value)}
                  className="pl-8 h-8 w-full sm:w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embarcación</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Fecha Salida</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zarpesPaginados.map((z) => (
                <TableRow key={z.id_zarpe || z.id}>
                  <TableCell className="font-medium">{z.embarcacion}</TableCell>
                  <TableCell>{z.socio_nombres || z.socio} {z.socio_apellidos || ''}</TableCell>
                  <TableCell>{new Date(z.fecha_salida).toLocaleDateString()} a las {z.hora_salida}</TableCell>
                  <TableCell>{new Date(z.fecha_retorno).toLocaleDateString()} a las {z.hora_retorno}</TableCell>
                  <TableCell>{z.destino}</TableCell>
                  <TableCell><EstadoBadge estado={z.estado} /></TableCell>
                  <TableCell className="flex items-center gap-2">
                    {z.estado === 'Pendiente' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50 h-8"
                        onClick={() => aprobarZarpe(z.id_zarpe || z.id)}
                      >
                        Aprobar
                      </Button>
                    )}
                    {z.estado === 'Aprobado' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8"
                        disabled={loadingPrint === (z.id_zarpe || z.id)}
                        onClick={() => handleImprimirZarpe(z.id_zarpe || z.id)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {loadingPrint === (z.id_zarpe || z.id) ? "Cargando..." : "Imprimir"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {zarpesFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                    {busquedaZarpes ? "No se encontraron zarpes con ese criterio de búsqueda." : "No hay zarpes registrados"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalZarpes > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 text-sm">
              <p className="text-muted-foreground">
                Mostrando registros del {inicioZarpes + 1} al {finZarpes} de un total de {totalZarpes} registros
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={paginaActualZarpes === 1}
                  onClick={() => setPaginaZarpes((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                {numerosPaginaZarpes.map((n, idx) =>
                  n === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={n}
                      variant={n === paginaActualZarpes ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPaginaZarpes(n as number)}
                    >
                      {n}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={paginaActualZarpes === totalPaginasZarpes}
                  onClick={() => setPaginaZarpes((p) => Math.min(totalPaginasZarpes, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================
          HOJA DE IMPRESIÓN — Oculta en pantalla, visible solo al imprimir
          ================================================================ */}
      {zarpeParaImprimir && (
        <div id="zona-impresion" className="hidden print:flex print:flex-col print:justify-between print:w-[210mm] print:h-[290mm] print:overflow-hidden print:pt-10 print:pb-8 print:px-16 print:bg-white print:absolute print:top-0 print:left-0">
          <style>{`@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background-color: white; -webkit-print-color-adjust: exact; } body * { visibility: hidden; } #zona-impresion, #zona-impresion * { visibility: visible; } #zona-impresion { position: absolute; left: 0; top: 0; } }`}</style>
          {/* Encabezado */}
          <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #222", paddingBottom: "16px" }}>
            <img
              src="/logo.png"
              alt="Logo Club Náutico Poseidón"
              className="w-28 h-28 object-contain mx-auto mb-3"
            />
            <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#555", marginBottom: "6px" }}>
              República del Perú — Ministerio de Transportes y Comunicaciones
            </p>
            <h1 style={{ fontSize: "22px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 4px 0" }}>
              Club Náutico Poseidón
            </h1>
            <h2 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "2px", margin: "0 0 8px 0", color: "#333" }}>
              Permiso de Zarpe Regularizado
            </h2>
            <p style={{ fontSize: "11px", color: "#666" }}>
              N.° de Zarpe: <strong>{zarpeParaImprimir.id_zarpe}</strong> &nbsp;|&nbsp; Fecha de emisión: <strong>{new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </p>
          </div>

          {/* Cuerpo del documento */}
          <div style={{ fontSize: "11.5px", lineHeight: "1.6", color: "#111", marginBottom: "16px" }}>
            <p style={{ textAlign: "justify", marginBottom: "10px" }}>
              Por medio del presente documento, el <strong>Club Náutico Poseidón</strong>, en ejercicio de sus funciones
              de control y supervisión de las operaciones marítimas de sus asociados, hace constar que se ha verificado
              y <strong>AUTORIZADO</strong> el permiso de zarpe correspondiente al socio:
            </p>

            {/* Datos en tabla */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "11px" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", width: "35%", backgroundColor: "#f5f5f5" }}>Nombre del Socio</td>
                  <td style={{ padding: "5px 10px" }}>{socioNombre || "—"}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Embarcación</td>
                  <td style={{ padding: "5px 10px" }}>{naveName}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Matrícula de la Nave</td>
                  <td style={{ padding: "5px 10px" }}>{naveMatricula}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Tripulante a Cargo</td>
                  <td style={{ padding: "5px 10px" }}>{tripNombre}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>N.° de Licencia</td>
                  <td style={{ padding: "5px 10px" }}>{tripLicencia}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Puerto / Destino</td>
                  <td style={{ padding: "5px 10px" }}>{destinoDoc}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Fecha y Hora de Salida</td>
                  <td style={{ padding: "5px 10px" }}>{fechaSalidaDoc} a las {horaSalidaDoc} hrs.</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Fecha y Hora de Retorno</td>
                  <td style={{ padding: "5px 10px" }}>{fechaRetornoDoc} a las {horaRetornoDoc} hrs.</td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 10px", fontWeight: "700", backgroundColor: "#f5f5f5" }}>Pasajeros a Bordo</td>
                  <td style={{ padding: "5px 10px" }}>{pasajerosDoc}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ textAlign: "justify", marginBottom: "8px" }}>
              Se hace constar que la embarcación <strong>{naveName}</strong> (matrícula: <strong>{naveMatricula}</strong>)
              ha cumplido con todos los requisitos de seguridad y habilitación exigidos por la normativa vigente del Club
              Náutico Poseidón, quedando autorizada su salida hacia <strong>{destinoDoc}</strong> el día{" "}
              <strong>{fechaSalidaDoc}</strong> a las <strong>{horaSalidaDoc} hrs.</strong>, con retorno previsto para
              el <strong>{fechaRetornoDoc}</strong> a las <strong>{horaRetornoDoc} hrs.</strong>
            </p>
            <p style={{ textAlign: "justify" }}>
              El tripulante responsable, <strong>{tripNombre}</strong> (licencia N.° <strong>{tripLicencia}</strong>),
              asume plena responsabilidad por la seguridad de la tripulación y los pasajeros a bordo durante toda
              la travesía. Cualquier modificación en el itinerario deberá ser comunicada inmediatamente a la
              administración del club.
            </p>
          </div>

          {/* =========================================================
              CONTENEDOR INFERIOR: break-inside-avoid prohíbe que pase a la hoja 2
              ========================================================= */}
          <div className="break-inside-avoid w-full">
            {/* Pie de página con firmas */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "48px" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderTop: "1.5px solid #333", paddingTop: "6px", marginTop: "36px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", margin: "0" }}>Capitanía / Personal Naviero</p>
                  <p style={{ fontSize: "9px", color: "#555", margin: "2px 0 0 0" }}>Nombre y sello oficial</p>
                </div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderTop: "1.5px solid #333", paddingTop: "6px", marginTop: "36px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", margin: "0" }}>Firma del Socio</p>
                  <p style={{ fontSize: "9px", color: "#555", margin: "2px 0 0 0" }}>
                    {`${zp?.socio_nombres || ""} ${zp?.socio_apellidos || ""}`.trim() || "Nombre del Socio"}
                  </p>
                </div>
              </div>
            </div>

            {/* Nota al pie pegada a las firmas */}
            <p style={{ marginTop: "16px", fontSize: "8.5px", color: "#888", textAlign: "center", borderTop: "1px solid #ccc", paddingTop: "8px" }}>
              Documento generado digitalmente por el sistema del Club Náutico Poseidón · Este permiso es válido únicamente para la travesía y fechas indicadas.
            </p>
          </div>
          {/* ========================================================= */}
        </div>
      )}
    </div>
  );
}