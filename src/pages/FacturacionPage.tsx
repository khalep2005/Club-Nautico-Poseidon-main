import { useState, useEffect, useMemo } from "react";
import { Receipt, Calculator, DollarSign, AlertCircle, Clock, CreditCard, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcularMontoCuota } from "@/lib/businessRules";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
// ── Tipos para los consumos reales del backend ──────────────────────────────
interface ConsumoDetalle {
  id_consumo: number;
  servicio: string;
  monto: number;
  descripcion: string;
  fecha_consumo: string;
}

interface SocioConConsumos {
  id_socio: number;
  dni: string;
  tipo_doc_siglas?: string;
  nombres: string;
  apellidos: string;
  total_consumos: number;
  consumos: ConsumoDetalle[];
}

// ── Tipos para los estados de cuenta reales del backend ─────────────────────
interface EstadoCuenta {
  id_socio: number;
  socio: string;
  total_deuda: number;
  estado: string;
}

interface SocioMoroso {
  id_factura: number;
  id_socio: number;
  nombres: string;
  apellidos: string;
  monto_total: number;
  estado_pago: string;
  dias_mora: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "Al día") {
    return <Badge className="bg-green-100 text-green-800 border-green-200">Al día</Badge>;
  }
  if (estado === "Pendiente") {
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendiente</Badge>;
  }
  if (estado === "Fraccionado") {
    return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Fraccionado</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 border-red-200">{estado}</Badge>;
}

function fmt(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Componente principal ─────────────────────────────────────────────────────
//
// NOTA SOBRE EL ALCANCE DE ESTE PANEL (Finanzas):
// Este panel se enfoca SOLO en las 2 responsabilidades de Finanzas:
//   1. Generar Facturación Mensual → vista de Estados de Cuenta
//   2. Aprobar Fraccionamiento de Deuda
// Lo que se quitó de aquí y por qué:
//   - "Registrar Consumo": es responsabilidad de Secretaría (panel SecretariaView).
//   - "Tasa SBS" + "Calcular Intereses": es responsabilidad de Cobranzas
//     (Gestionar Morosidad - Cálculo SBS), ahora vive en DashboardCobranza.
//   - "Registrar Pago": es responsabilidad de Cobranzas (quien recauda),
//     ahora vive en DashboardCobranza.
//
export default function FacturacionPage() {
  const { toast } = useToast();

  // ── Estados de Cuenta (datos REALES del backend) ────────────────────────────
  const [estadosCuenta, setEstadosCuenta] = useState<EstadoCuenta[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [errorCuentas, setErrorCuentas] = useState<string | null>(null);

  // ── Estados de tabla "Cuentas de Socios": búsqueda y paginación ──────────
  const [busquedaCuentas, setBusquedaCuentas] = useState("");
  const [registrosPorPaginaCuentas, setRegistrosPorPaginaCuentas] = useState(10);
  const [paginaActualCuentas, setPaginaActualCuentas] = useState(1);

  // Nota: ms-facturacion no conoce el nombre del socio (vive en ms-socios, otra
  // base de datos) -- se muestra "Socio #<id>" como placeholder.
  const fetchEstadosCuenta = async () => {
    setCargandoCuentas(true);
    setErrorCuentas(null);
    try {
      const res = await apiFetch("/api/facturas/estados-cuenta");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar los estados de cuenta.`);
      const raw: { id_socio: number; total_deuda: number; estado: string }[] = await res.json();
      const data: EstadoCuenta[] = raw.map((r) => ({
        id_socio: r.id_socio,
        socio: `Socio #${r.id_socio}`,
        total_deuda: r.total_deuda,
        estado: r.estado,
      }));
      setEstadosCuenta(data);
    } catch (err) {
      setErrorCuentas(err instanceof Error ? err.message : "Error inesperado al cargar estados de cuenta.");
    } finally {
      setCargandoCuentas(false);
    }
  };

  // ── Filtrado de "Cuentas de Socios" por búsqueda (nombre o estado) ───────
  const estadosCuentaFiltrados = useMemo(() => {
    if (!busquedaCuentas.trim()) return estadosCuenta;
    const termino = busquedaCuentas.trim().toLowerCase();
    return estadosCuenta.filter(
      (c) =>
        c.socio.toLowerCase().includes(termino) ||
        c.estado.toLowerCase().includes(termino)
    );
  }, [estadosCuenta, busquedaCuentas]);

  // ── Paginación de "Cuentas de Socios" ─────────────────────────────────────
  const totalPaginasCuentas = Math.max(1, Math.ceil(estadosCuentaFiltrados.length / registrosPorPaginaCuentas));

  useEffect(() => {
    setPaginaActualCuentas(1);
  }, [busquedaCuentas, registrosPorPaginaCuentas]);

  const estadosCuentaPagina = useMemo(() => {
    const inicio = (paginaActualCuentas - 1) * registrosPorPaginaCuentas;
    return estadosCuentaFiltrados.slice(inicio, inicio + registrosPorPaginaCuentas);
  }, [estadosCuentaFiltrados, paginaActualCuentas, registrosPorPaginaCuentas]);

  const inicioRangoCuentas = estadosCuentaFiltrados.length === 0 ? 0 : (paginaActualCuentas - 1) * registrosPorPaginaCuentas + 1;
  const finRangoCuentas = Math.min(paginaActualCuentas * registrosPorPaginaCuentas, estadosCuentaFiltrados.length);

  // ── Consumos Pendientes (datos REALES del backend, registrados por Secretaría) ──
  const [consumosPendientes, setConsumosPendientes] = useState<SocioConConsumos[]>([]);
  const [cargandoConsumos, setCargandoConsumos] = useState(true);
  const [errorConsumos, setErrorConsumos] = useState<string | null>(null);
  const [generandoFacturacion, setGenerandoFacturacion] = useState(false);

  const fetchConsumosPendientes = async () => {
    setCargandoConsumos(true);
    setErrorConsumos(null);
    try {
      const res = await apiFetch("/api/consumos/sin-facturar/agrupados");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar los consumos pendientes.`);
      const raw: { id_socio: number; total_consumos: number; consumos: ConsumoDetalle[] }[] = await res.json();
      const data: SocioConConsumos[] = raw.map((r) => ({
        id_socio: r.id_socio,
        dni: "",
        nombres: `Socio #${r.id_socio}`,
        apellidos: "",
        total_consumos: r.total_consumos,
        consumos: r.consumos,
      }));
      setConsumosPendientes(data);
    } catch (err) {
      setErrorConsumos(err instanceof Error ? err.message : "Error inesperado al cargar consumos.");
    } finally {
      setCargandoConsumos(false);
    }
  };

  const [morosos, setMorosos] = useState<SocioMoroso[]>([]);
  const [cargandoMorosos, setCargandoMorosos] = useState(true);
  const [errorMorosos, setErrorMorosos] = useState<string | null>(null);

  const fetchMorosos = async () => {
    setCargandoMorosos(true);
    setErrorMorosos(null);
    try {
      const res = await apiFetch("/api/cobranza/vencidas");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar los socios morosos.`);
      const raw: { idFactura: number; idSocio: number; totalAcumulado: number; estadoPago: string; diasMora: number }[] = await res.json();
      const data: SocioMoroso[] = raw.map((r) => ({
        id_factura: r.idFactura,
        id_socio: r.idSocio,
        nombres: `Socio #${r.idSocio}`,
        apellidos: "",
        monto_total: r.totalAcumulado,
        estado_pago: r.estadoPago,
        dias_mora: r.diasMora,
      }));
      setMorosos(data);
    } catch (err) {
      setErrorMorosos(err instanceof Error ? err.message : "Error inesperado al cargar morosos.");
    } finally {
      setCargandoMorosos(false);
    }
  };

  useEffect(() => {
    fetchEstadosCuenta();
    fetchConsumosPendientes();
    fetchMorosos();
  }, []);

  const totalGeneralPendiente = consumosPendientes.reduce((acc, s) => acc + s.total_consumos, 0);

  // ── Fraccionamiento ───────────────────────────────────────────────────────
  const [fSocio, setFSocio] = useState("");
  const [fCuotas, setFCuotas] = useState("3");

  const facturaSeleccionada = morosos.find((m) => String(m.id_factura) === fSocio);
  const montoCuota = facturaSeleccionada
    ? calcularMontoCuota(facturaSeleccionada.monto_total, Number(fCuotas))
    : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleFraccion(e: React.FormEvent) {
    e.preventDefault();
    if (!fSocio || !facturaSeleccionada) return;
    try {
      const res = await apiFetch("/api/facturas/fraccionar", {
  method: "POST",
  body: JSON.stringify({
    id_factura: Number(fSocio),
    cuotas: Number(fCuotas),
  }),
});
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "No se pudo realizar el fraccionamiento.");

      toast({
        title: "Deuda fraccionada",
        description: `${fCuotas} cuotas de ${fmt(montoCuota)} para ${facturaSeleccionada.nombres} ${facturaSeleccionada.apellidos}.`,
      });
      setFSocio("");
      setFCuotas("3");
      await fetchMorosos();
      await fetchEstadosCuenta();
    } catch (err) {
      toast({
        title: "Error al fraccionar deuda",
        description: err instanceof Error ? err.message : "Error inesperado.",
        variant: "destructive",
      });
    }
  }

  // Nota: la generación masiva solo consolida consumos pendientes -- no agrega
  // membresía fija ni cobro de radas (esos datos viven en ms-socios/ms-nautica).
  async function handleGenerarFacturacion() {
    setGenerandoFacturacion(true);
    try {
      const res = await apiFetch("/api/facturas/generar", {
  method: "POST",
});
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "No se pudo generar la facturación.");

      toast({
        title: "Facturación generada",
        description: data.mensaje || `Se generaron ${data.facturas_generadas} factura(s).`,
      });

      // Refresca la lista: los consumos recién facturados ya no deberían aparecer
      await fetchConsumosPendientes();
    } catch (err) {
      toast({
        title: "Error al generar facturación",
        description: err instanceof Error ? err.message : "Error inesperado.",
        variant: "destructive",
      });
    } finally {
      setGenerandoFacturacion(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Facturación y Finanzas</h1>
        <p className="text-muted-foreground text-sm">Estados de cuenta y fraccionamiento de deuda</p>
      </div>

      <Tabs defaultValue="cuentas" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="cuentas" className="gap-2">
            <Receipt className="h-4 w-4" /> Estados de Cuenta
          </TabsTrigger>
          <TabsTrigger value="consumos-pendientes" className="gap-2">
            <DollarSign className="h-4 w-4" /> Consumos Pendientes
          </TabsTrigger>
          <TabsTrigger value="fraccionamiento" className="gap-2">
            <Calculator className="h-4 w-4" /> Fraccionamiento
          </TabsTrigger>
        </TabsList>

        {/* ── PESTAÑA 1: ESTADOS DE CUENTA (Generar Facturación Mensual) ── */}
        <TabsContent value="cuentas" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Cuentas de Socios
              </CardTitle>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Selector de registros por página */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Select
                    value={String(registrosPorPaginaCuentas)}
                    onValueChange={(v) => setRegistrosPorPaginaCuentas(Number(v))}
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
                    placeholder="Buscar por socio o estado"
                    value={busquedaCuentas}
                    onChange={(e) => setBusquedaCuentas(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {cargandoCuentas ? (
                <div className="space-y-3 py-2">
                  {/* Cabecera simulada */}
                  <div className="flex gap-4 px-1 pb-1 border-b border-border">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24 ml-auto" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  {/* 5 filas simuladas */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : errorCuentas ? (
                <p className="text-center text-destructive py-10 text-sm">{errorCuentas}</p>
              ) : estadosCuentaFiltrados.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">
                  {busquedaCuentas ? "No se encontraron resultados." : "No hay estados de cuenta disponibles."}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Socio</TableHead>
                          <TableHead className="text-right">Total Deuda</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {estadosCuentaPagina.map((c) => (
                          <TableRow key={c.id_socio}>
                            <TableCell className="font-medium">{c.socio}</TableCell>
                            <TableCell className="text-right font-bold">{fmt(c.total_deuda)}</TableCell>
                            <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Info de rango + paginación */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando registros del {inicioRangoCuentas} al {finRangoCuentas} de un total de {estadosCuentaFiltrados.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaActualCuentas === 1}
                        onClick={() => setPaginaActualCuentas((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      {Array.from({ length: totalPaginasCuentas }, (_, i) => i + 1).map((num) => (
                        <Button
                          key={num}
                          variant={num === paginaActualCuentas ? "default" : "outline"}
                          size="sm"
                          className={num === paginaActualCuentas ? "bg-blue-900 text-white" : ""}
                          onClick={() => setPaginaActualCuentas(num)}
                        >
                          {num}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paginaActualCuentas === totalPaginasCuentas}
                        onClick={() => setPaginaActualCuentas((p) => Math.min(totalPaginasCuentas, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PESTAÑA 2: CONSUMOS PENDIENTES (datos reales del backend) ── */}
        <TabsContent value="consumos-pendientes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Consumos Pendientes de Facturación
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Datos reales registrados por Secretaría, agrupados por socio, aún no incluidos en una factura.
                </p>
              </div>
              <Button
                onClick={handleGenerarFacturacion}
                disabled={generandoFacturacion || consumosPendientes.length === 0}
                className="gap-2 shrink-0"
              >
                <Receipt className="h-4 w-4" />
                {generandoFacturacion ? "Generando..." : "Generar Facturación Mensual"}
              </Button>
            </CardHeader>
            <CardContent>
              {cargandoConsumos ? (
                <div className="space-y-4 py-2">
                  {/* Banner de total simulado */}
                  <Skeleton className="h-9 w-full rounded-lg" />
                  {/* 2 tarjetas de socio simuladas */}
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border overflow-hidden">
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </div>
                      {/* 3 filas de consumo simuladas */}
                      <div className="divide-y divide-border">
                        {Array.from({ length: 3 }).map((_, j) => (
                          <div key={j} className="flex items-center gap-4 px-4 py-3">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-16 ml-auto" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : errorConsumos ? (
                <p className="text-center text-destructive py-10 text-sm">{errorConsumos}</p>
              ) : consumosPendientes.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">
                  No hay consumos pendientes de facturación.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Total pendiente de todos los socios: </span>
                    <span className="font-bold text-blue-950 dark:text-blue-100">{fmt(totalGeneralPendiente)}</span>
                  </div>
                  {consumosPendientes.map((socio) => (
                    <div key={socio.id_socio} className="rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="font-semibold text-sm">{socio.nombres} {socio.apellidos}</p>
                          <p className="text-xs text-muted-foreground">
                            {socio.tipo_doc_siglas || "DNI"} {socio.dni}
                          </p>
                        </div>
                        <p className="font-bold text-foreground">{fmt(socio.total_consumos)}</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {socio.consumos.map((c) => (
                            <TableRow key={c.id_consumo}>
                              <TableCell className="text-sm">{c.servicio}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{c.descripcion}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(c.fecha_consumo).toLocaleDateString("es-PE")}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">{fmt(c.monto)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PESTAÑA 3: FRACCIONAMIENTO DE DEUDA ──────────────────────── */}
        <TabsContent value="fraccionamiento">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* ── COLUMNA IZQUIERDA: Formulario ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  Aprobar Fraccionamiento de Deuda
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Selecciona un socio moroso y el número de cuotas para generar el plan de pago.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFraccion} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Socio Moroso</label>
                    {cargandoMorosos ? (
                      <p className="text-xs text-muted-foreground">Cargando socios morosos...</p>
                    ) : errorMorosos ? (
                      <p className="text-xs text-destructive">{errorMorosos}</p>
                    ) : (
                      <Select value={fSocio} onValueChange={setFSocio}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar socio moroso" /></SelectTrigger>
                        <SelectContent>
                          {morosos.map((m) => (
                            <SelectItem key={m.id_factura} value={String(m.id_factura)}>
                              {m.nombres} {m.apellidos} — {fmt(m.monto_total)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!cargandoMorosos && !errorMorosos && morosos.length === 0 && (
                      <p className="text-xs text-muted-foreground">No hay socios morosos actualmente.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Número de Cuotas</label>
                    <Select value={fCuotas} onValueChange={setFCuotas}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} cuotas</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Máximo permitido: 6 cuotas mensuales.</p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={!fSocio || morosos.length === 0}
                  >
                    <Calculator className="h-4 w-4" /> Confirmar Fraccionamiento
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* ── COLUMNA DERECHA: Tarjeta informativa dinámica ── */}
            {facturaSeleccionada ? (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <CreditCard className="h-4 w-4" />
                    Detalle del Socio Seleccionado
                  </CardTitle>
                  <p className="text-sm font-semibold text-foreground">
                    {facturaSeleccionada.nombres} {facturaSeleccionada.apellidos}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Métricas clave */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-background border border-border p-3 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Monto Total Adeudado</p>
                      <p className="text-lg font-bold text-foreground">{fmt(facturaSeleccionada.monto_total)}</p>
                    </div>
                    <div className="rounded-lg bg-background border border-border p-3 space-y-0.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Días en Mora
                      </p>
                      <p className={`text-lg font-bold ${
                        facturaSeleccionada.dias_mora > 30
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {facturaSeleccionada.dias_mora} días
                      </p>
                    </div>
                  </div>

                  {/* Estado de pago */}
                  <div className="rounded-lg bg-background border border-border p-3 flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Estado de Pago</p>
                      <p className="text-sm font-semibold text-foreground">{facturaSeleccionada.estado_pago}</p>
                    </div>
                  </div>

                  {/* Separador y cálculo de cuotas */}
                  <div className="border-t border-blue-200 dark:border-blue-800 pt-3 space-y-2">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Plan de Pago Calculado
                    </p>
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm text-muted-foreground">
                        {fCuotas} cuota{Number(fCuotas) > 1 ? "s" : ""} de
                      </p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {fmt(montoCuota)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total a fraccionar: <span className="font-semibold text-foreground">{fmt(facturaSeleccionada.monto_total)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Placeholder cuando no hay socio seleccionado */
              <div className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground min-h-[280px]">
                <CreditCard className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">Selecciona un socio moroso</p>
                <p className="text-xs opacity-70">El detalle de la deuda y el plan de cuotas aparecerá aquí</p>
              </div>
            )}

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
