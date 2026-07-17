import { useState, useEffect } from "react";
import { LogOut, Search, UserX, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";
interface SolicitudRetiro {
  id_solicitud: number;
  id_socio: number;
  motivo: string;
  fecha_solicitud: string;
  estado_solicitud: string;
  nombres: string;
  apellidos: string;
  dni: string;
  deuda_pendiente: number;
}

const OPCIONES_POR_PAGINA = [5, 10, 25, 50];
const API_URL = import.meta.env.VITE_API_URL || "https://api-poseidon.onrender.com";

// Helper: formatea fecha a dd/mm/yyyy
function formatFecha(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TablaRetirosPendientes() {
  const [solicitudes, setSolicitudes] = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);

  const [search, setSearch] = useState("");
  const [porPagina, setPorPagina] = useState(5);
  const [paginaActual, setPaginaActual] = useState(1);

  // Estados para el Dialog de confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudRetiro | null>(null);

  // Cargar solicitudes de retiro pendientes desde el backend
  // Nota: deuda_pendiente siempre viene en 0 -- el backend de microservicios
  // no valida deuda cruzando a ms-facturacion todavía (ver RetiroService.java).
  const fetchSolicitudes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/retiros/pendientes");

      if (!res.ok) {
        throw new Error(`Error ${res.status}: no se pudieron cargar las solicitudes.`);
      }

      const data: SolicitudRetiro[] = await res.json();
      setSolicitudes(data);
    } catch (err: any) {
      setError(err.message || "Error al cargar las solicitudes de retiro.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  // Reiniciar página al cambiar búsqueda o paginación
  useEffect(() => {
    setPaginaActual(1);
  }, [search, porPagina]);

  // Filtrado de solicitudes pendientes
  const solicitudesPendientes = solicitudes.filter(
    (s) => s.estado_solicitud === "Pendiente"
  );

  const solicitudesFiltradas = solicitudesPendientes.filter((s) => {
    const nombreCompleto = `${s.nombres} ${s.apellidos}`.toLowerCase();
    return nombreCompleto.includes(search.toLowerCase()) || s.dni.includes(search);
  });

  // Paginación
  const totalRegistros = solicitudesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / porPagina));
  const indiceInicio = (paginaActual - 1) * porPagina;
  const indiceFin = Math.min(indiceInicio + porPagina, totalRegistros);
  const solicitudesPaginadas = solicitudesFiltradas.slice(indiceInicio, indiceFin);

  const irAPagina = (pagina: number) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaActual(pagina);
  };

  const obtenerNumerosPagina = () => {
    const inicio = Math.max(1, paginaActual - 2);
    const fin = Math.min(totalPaginas, inicio + 4);
    const paginas = [];
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  };

  const handleDarDeBajaClick = (solicitud: SolicitudRetiro) => {
    if (solicitud.deuda_pendiente > 0) {
      toast.error("No se puede dar de baja a un socio con deuda pendiente.");
      return;
    }
    setSolicitudSeleccionada(solicitud);
    setShowConfirm(true);
  };

  const handleConfirmarBaja = async () => {
    if (!solicitudSeleccionada) return;

    setProcesandoBaja(true);
    try {
      const res = await apiFetch("/api/retiros/aprobar", {
  method: "POST",
  body: JSON.stringify({
    id_solicitud: solicitudSeleccionada.id_solicitud,
    id_socio: solicitudSeleccionada.id_socio,
  }),
});
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.mensaje || `Error ${res.status}: no se pudo procesar la baja.`);
      }

      toast.success("Socio dado de baja con éxito", {
        description: `Se ha liquidado y procesado el retiro definitivo de ${solicitudSeleccionada.nombres} ${solicitudSeleccionada.apellidos}.`,
      });

      setShowConfirm(false);
      setSolicitudSeleccionada(null);
      fetchSolicitudes(); // Recargar la lista desde el servidor para reflejar la baja instantáneamente
    } catch (err: any) {
      toast.error("Error al procesar la baja", {
        description: err.message || "Ocurrió un problema al conectar con el servidor.",
      });
    } finally {
      setProcesandoBaja(false);
    }
  };

  return (
    <>
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <LogOut className="h-4 w-4 text-slate-500 dark:text-slate-400 rotate-180" />
              Solicitudes de Retiro Pendientes
            </CardTitle>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Selector de cantidad */}
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Mostrar</span>
                <Select
                  value={String(porPagina)}
                  onValueChange={(val) => setPorPagina(Number(val))}
                >
                  <SelectTrigger className="w-16 h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_POR_PAGINA.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>registros</span>
              </div>

              {/* Buscador */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Nombre del socio..."
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-rose-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/20 dark:bg-slate-950/20">
              <TableRow className="border-b border-slate-200 dark:border-slate-800">
                <TableHead className="font-bold text-xs pl-6 py-3">Nombre del Socio</TableHead>
                <TableHead className="font-bold text-xs">Fecha de Solicitud</TableHead>
                <TableHead className="font-bold text-xs">Deuda Pendiente</TableHead>
                <TableHead className="font-bold text-xs">Estado</TableHead>
                <TableHead className="font-bold text-xs text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-sm text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                      <span>Cargando solicitudes de retiro...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-sm text-red-500 font-semibold">
                    {error}
                  </TableCell>
                </TableRow>
              ) : solicitudesPaginadas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-slate-400 dark:text-slate-500 py-10 text-sm"
                  >
                    No se encontraron solicitudes de retiro pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                solicitudesPaginadas.map((r) => {
                  const tieneDeuda = r.deuda_pendiente > 0;
                  return (
                    <TableRow
                      key={r.id_solicitud}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <TableCell className="font-semibold text-sm text-slate-950 dark:text-slate-100 pl-6 py-4">
                        {r.nombres} {r.apellidos}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {formatFecha(r.fecha_solicitud)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span
                          className={
                            tieneDeuda
                              ? "text-red-600 font-bold dark:text-red-400"
                              : "text-emerald-600 font-bold dark:text-emerald-400"
                          }
                        >
                          S/ {r.deuda_pendiente.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tieneDeuda ? (
                          <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400 border border-rose-500/20 shadow-none font-semibold rounded-md">
                            Con Deuda
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-semibold rounded-md">
                            Sin Deuda
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm"
                          disabled={tieneDeuda}
                          onClick={() => handleDarDeBajaClick(r)}
                          variant={tieneDeuda ? "ghost" : "outline"}
                          className={`gap-1.5 h-8 text-xs rounded-lg transition-all ${tieneDeuda
                              ? "bg-slate-100 text-slate-400 border-none dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                              : "border-destructive text-destructive hover:bg-rose-600 hover:text-white dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                            }`}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Dar de Baja
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Barra de paginación */}
          {!loading && !error && totalRegistros > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando registros del <span className="font-semibold">{indiceInicio + 1}</span> al{" "}
                <span className="font-semibold">{indiceFin}</span> de un total de{" "}
                <span className="font-semibold">{totalRegistros}</span> registros
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                  onClick={() => irAPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Button>

                {obtenerNumerosPagina().map((num) => (
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
                  className="gap-1 h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
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

      {/* AlertDialog de Confirmación */}
      <AlertDialog open={showConfirm} onOpenChange={(val) => { if (!procesandoBaja) setShowConfirm(val); }}>
        <AlertDialogContent className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 sm:max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <UserX className="h-5 w-5 text-destructive" />
              ¿Confirmar Baja del Socio?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-slate-600 dark:text-slate-400">
              <span className="block">
                Está a punto de retirar definitivamente al socio{" "}
                <strong className="text-slate-900 dark:text-white">
                  {solicitudSeleccionada?.nombres} {solicitudSeleccionada?.apellidos}
                </strong>
                . Esta acción liquidará su membresía y no podrá revertirse.
              </span>
              <span className="block bg-slate-50 dark:bg-slate-950 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Motivo de Retiro (Secretaría):
                </span>
                <span className="block text-sm italic text-slate-700 dark:text-slate-300">
                  &ldquo;{solicitudSeleccionada?.motivo}&rdquo;
                </span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowConfirm(false);
                  setSolicitudSeleccionada(null);
                }}
                className="rounded-lg"
                disabled={procesandoBaja}
              >
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={handleConfirmarBaja}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg gap-2"
                disabled={procesandoBaja}
              >
                {procesandoBaja ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar y Dar de Baja"
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
