import { useState, useEffect } from "react";
import {
  CheckCircle, XCircle, FileText, ClipboardCheck,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import TablaRetirosPendientes from "@/components/TablaRetirosPendientes";
import { apiFetch } from "@/lib/apiClient"; 
// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface SolicitudAPI {
  id_solicitud: number;
  nombres: string;
  apellidos: string;
  dni: string;
  tipo_doc_siglas?: string;
  clasificacion: string;
  estado: string;
  fecha_creacion: string;
}

const OPCIONES_POR_PAGINA = [5, 10, 25, 50];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clasificacionBadge(clasificacion: string) {
  switch (clasificacion) {
    case "Pagador":
      return <Badge className="bg-success text-success-foreground hover:bg-success/90">Pagador</Badge>;
    case "Renuente":
      return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Renuente</Badge>;
    default:
      return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">{clasificacion || "Esporádico"}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function JefeView() {
  const [pendientes, setPendientes] = useState<SolicitudAPI[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  // ── Modal de rechazo ──────────────────────────────────────────────────────
  const [rechazoDialog, setRechazoDialog] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<number | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // ── Búsqueda + paginación: Bandeja de Aprobaciones ────────────────────────
  const [busquedaAprob, setBusquedaAprob] = useState("");
  const [paginaAprob, setPaginaAprob] = useState(1);
  const [porPaginaAprob, setPorPaginaAprob] = useState(10);

  // ── Fetch solicitudes pendientes ──────────────────────────────────────────
     const fetchPendientes = async () => {
  setCargandoLista(true);
  setErrorLista(null);
  try {
    const res = await apiFetch("/api/solicitudes");
    if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar las solicitudes.`);
      const data: SolicitudAPI[] = await res.json();
      setPendientes(data.filter((s) => s.estado === "Pendiente"));
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => { fetchPendientes(); }, []);

  // ── Aprobar ───────────────────────────────────────────────────────────────
  const handleAprobar = async (id: number) => {
    setEnviando(true);
    try {
      const res = await apiFetch(`/api/solicitudes/${id}/evaluar`, {
  method: "PUT",
  body: JSON.stringify({ estado_nuevo: "Aprobado", observacion: null }),
});
      if (res.status === 200) {
        setPendientes((prev) => prev.filter((s) => s.id_solicitud !== id));
        toast.success("Solicitud aprobada exitosamente.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.mensaje ?? `Error ${res.status}: no se pudo aprobar.`);
      }
    } catch {
      toast.error("Error de red al intentar aprobar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Abrir modal de rechazo ────────────────────────────────────────────────
  const abrirRechazo = (id: number) => {
    setSolicitudSeleccionada(id);
    setMotivoRechazo("");
    setRechazoDialog(true);
  };

  // ── Confirmar rechazo ─────────────────────────────────────────────────────
  const confirmarRechazo = async () => {
    if (!motivoRechazo.trim() || solicitudSeleccionada === null) return;
    setEnviando(true);
    try {
      const res = await apiFetch(`/api/solicitudes/${solicitudSeleccionada}/evaluar`, {
  method: "PUT",
  body: JSON.stringify({ estado_nuevo: "Rechazado", observacion: motivoRechazo.trim() }),
});
      if (res.status === 200) {
        setPendientes((prev) => prev.filter((s) => s.id_solicitud !== solicitudSeleccionada));
        setRechazoDialog(false);
        toast.error("Solicitud rechazada.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.mensaje ?? `Error ${res.status}: no se pudo rechazar.`);
      }
    } catch {
      toast.error("Error de red al intentar rechazar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Filtrado + paginación: Bandeja de Aprobaciones ────────────────────────
  const pendientesFiltrados = pendientes.filter((s) => {
    const texto = `${s.nombres} ${s.apellidos} ${s.dni}`.toLowerCase();
    return texto.includes(busquedaAprob.toLowerCase());
  });
  const totalAprob = pendientesFiltrados.length;
  const totalPagAprob = Math.max(1, Math.ceil(totalAprob / porPaginaAprob));
  const inicioAprob = (paginaAprob - 1) * porPaginaAprob;
  const finAprob = Math.min(inicioAprob + porPaginaAprob, totalAprob);
  const pendientesPaginados = pendientesFiltrados.slice(inicioAprob, finAprob);

  useEffect(() => { setPaginaAprob(1); }, [busquedaAprob, porPaginaAprob]);

  const irAPaginaAprob = (pagina: number) => {
    if (pagina < 1 || pagina > totalPagAprob) return;
    setPaginaAprob(pagina);
  };

  const numerosPaginaAprob = () => {
    const paginas: number[] = [];
    const inicio = Math.max(1, paginaAprob - 2);
    const fin = Math.min(totalPagAprob, inicio + 4);
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aprobaciones y Retiros</h1>
      </div>

      {/* Bandeja de Aprobaciones */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              Bandeja de Aprobaciones
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Mostrar</span>
                <Select
                  value={String(porPaginaAprob)}
                  onValueChange={(val) => setPorPaginaAprob(Number(val))}
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
                  value={busquedaAprob}
                  onChange={(e) => setBusquedaAprob(e.target.value)}
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
                <TableHead>Clasificación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoLista ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Cargando solicitudes...
                  </TableCell>
                </TableRow>
              ) : errorLista ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive py-10">
                    {errorLista}
                  </TableCell>
                </TableRow>
              ) : pendientesPaginados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No hay solicitudes pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                pendientesPaginados.map((s) => (
                  <TableRow key={s.id_solicitud}>
                    <TableCell className="font-medium">{s.nombres} {s.apellidos}</TableCell>
                    <TableCell className="font-medium text-xs"><span className="text-muted-foreground mr-1">{s.tipo_doc_siglas || 'DNI'}</span>{s.dni}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{clasificacionBadge(s.clasificacion)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-success-foreground gap-1.5"
                          onClick={() => handleAprobar(s.id_solicitud)}
                          disabled={enviando}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => abrirRechazo(s.id_solicitud)}
                          disabled={enviando}
                        >
                          <XCircle className="h-4 w-4" />
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Paginación Bandeja de Aprobaciones ──────────────────────── */}
          {!cargandoLista && !errorLista && totalAprob > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando registros del <span className="font-semibold">{inicioAprob + 1}</span> al{" "}
                <span className="font-semibold">{finAprob}</span> de un total de{" "}
                <span className="font-semibold">{totalAprob}</span> registros
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8"
                  onClick={() => irAPaginaAprob(paginaAprob - 1)}
                  disabled={paginaAprob === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </Button>
                {numerosPaginaAprob().map((num) => (
                  <Button
                    key={num}
                    variant={num === paginaAprob ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => irAPaginaAprob(num)}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-8"
                  onClick={() => irAPaginaAprob(paginaAprob + 1)}
                  disabled={paginaAprob === totalPagAprob}
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liquidaciones y Retiros */}
      <TablaRetirosPendientes />

      {/* Modal de Rechazo */}
      <Dialog open={rechazoDialog} onOpenChange={(v) => { if (!v) setRechazoDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              Motivo de Rechazo
            </DialogTitle>
            <DialogDescription>
              Ingrese el motivo de rechazo. Este documento es obligatorio según el reglamento del club.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describa el motivo de rechazo de la solicitud..."
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoDialog(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarRechazo}
              disabled={!motivoRechazo.trim() || enviando}
            >
              {enviando ? "Enviando..." : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
