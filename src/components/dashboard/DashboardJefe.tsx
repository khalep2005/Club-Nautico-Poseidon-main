import { useState, useEffect } from "react";
import { ClipboardCheck, Users, BarChart3, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient"; 
interface SolicitudAPI {
  id_solicitud:   number;
  dni:            string;
  tipo_doc_siglas?: string;
  nombres:        string;
  apellidos:      string;
  estado:         string;
  fecha_creacion: string;
}

const OPCIONES_POR_PAGINA = [5, 10, 25, 50];

function estadoBadge(estado: string) {
  switch (estado) {
    case "Aprobado":
      return <Badge className="bg-success text-success-foreground hover:bg-success/90">Aprobado</Badge>;
    case "Rechazado":
      return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Rechazado</Badge>;
    default:
      return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Pendiente</Badge>;
  }
}

export default function DashboardJefe() {
  const [solicitudes, setSolicitudes]     = useState<SolicitudAPI[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista]       = useState<string | null>(null);

  // ── Búsqueda + paginación ─────────────────────────────────────────────────
  const [busqueda, setBusqueda]           = useState("");
  const [paginaActual, setPaginaActual]   = useState(1);
  const [porPagina, setPorPagina]         = useState(10);

  useEffect(() => {
  // TODO(backend): "solicitudes" no existe en ningún microservicio -- ver nota
  // detallada en SecretariaView.tsx (fetchSolicitudes). Es funcionalidad nueva
  // por construir, no una ruta mal escrita.
  const fetchSolicitudes = async () => {
    setCargandoLista(true);
    setErrorLista(null);
    try {
      const res = await apiFetch("/api/solicitudes");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: SolicitudAPI[] = await res.json();
      setSolicitudes(data);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargandoLista(false);
    }
  };
  fetchSolicitudes();
}, []);

  const pendientes = solicitudes.filter((s) => s.estado === "Pendiente").length;

  // ── Filtrado en tiempo real ───────────────────────────────────────────────
  const solicitudesFiltradas = solicitudes.filter((s) => {
    const texto = `${s.nombres} ${s.apellidos} ${s.dni}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  // ── Cálculos de paginación ────────────────────────────────────────────────
  const totalRegistros = solicitudesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / porPagina));
  const indiceInicio = (paginaActual - 1) * porPagina;
  const indiceFin = Math.min(indiceInicio + porPagina, totalRegistros);
  const solicitudesPaginadas = solicitudesFiltradas.slice(indiceInicio, indiceFin);

  useEffect(() => { setPaginaActual(1); }, [busqueda, porPagina]);

  const irAPagina = (pagina: number) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaActual(pagina);
  };

  const numerosDePagina = () => {
    const paginas: number[] = [];
    const inicio = Math.max(1, paginaActual - 2);
    const fin = Math.min(totalPaginas, inicio + 4);
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel del Jefe</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Aprobaciones Pendientes</p>
                <p className="text-2xl font-bold text-foreground">{cargandoLista ? "…" : pendientes}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-warning/10">
                <ClipboardCheck className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Solicitudes</p>
                <p className="text-2xl font-bold text-foreground">{cargandoLista ? "…" : solicitudes.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-accent">
                <Users className="h-5 w-5 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Crecimiento</p>
                <p className="text-2xl font-bold text-foreground">+12%</p>
              </div>
              <div className="p-2.5 rounded-lg bg-success/10">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de solicitudes para aprobación */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Solicitudes Pendientes de Aprobación
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Mostrar</span>
                <Select
                  value={String(porPagina)}
                  onValueChange={(val) => setPorPagina(Number(val))}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_POR_PAGINA.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>registros</span>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nombre, apellido o DNI..."
                  className="pl-8 h-8 text-xs"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoLista ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">Cargando...</TableCell>
                </TableRow>
              ) : errorLista ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive py-10">{errorLista}</TableCell>
                </TableRow>
              ) : solicitudesPaginadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">No hay solicitudes.</TableCell>
                </TableRow>
              ) : (
                solicitudesPaginadas.map((s) => (
                  <TableRow key={s.id_solicitud}>
                    <TableCell className="font-medium">{s.nombres} {s.apellidos}</TableCell>
                    <TableCell className="font-medium text-xs text-muted-foreground"><span className="mr-1">{s.tipo_doc_siglas || 'DNI'}</span><span className="text-foreground">{s.dni}</span></TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{estadoBadge(s.estado)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Barra de paginación ────────────────────────────────────────── */}
          {!cargandoLista && !errorLista && totalRegistros > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando registros del <span className="font-semibold">{indiceInicio + 1}</span> al{" "}
                <span className="font-semibold">{indiceFin}</span> de un total de{" "}
                <span className="font-semibold">{totalRegistros}</span> registros
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8"
                  onClick={() => irAPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Button>

                {numerosDePagina().map((num) => (
                  <Button
                    key={num}
                    variant={num === paginaActual ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => irAPagina(num)}
                  >
                    {num}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8"
                  onClick={() => irAPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
