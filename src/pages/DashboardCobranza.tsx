import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  ShieldAlert,
  TrendingUp,
  CreditCard,
  Calculator,
  Loader2,
  Search,
  Clock,
  CheckCircle2,
  Wallet,
  Users2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@radix-ui/react-label";
import { apiFetch } from "@/lib/apiClient";

// ===================================================================
// Dashboard de Cobranzas — un solo componente, tres vistas según la ruta.
// - "/dashboard/cobranza"          -> Panel de Cobranza (facturas por vencer)
// - "/dashboard/morosidad"         -> Gestión de Morosidad (facturas vencidas SBS)
// - "/dashboard/pagos-realizados"  -> Historial de Pagos Realizados
//
// Consume:
// - GET /api/facturacion/por-vencer  (facturas pendientes aún no vencidas)
// - GET /api/facturacion/morosos     (cálculo SBS dinámico de intereses)
// - GET /api/facturacion/pagados     (historial de facturas cobradas)
// - POST /api/facturacion/pagar      (registrar pago, con o sin interés)
// ===================================================================

const MOROSIDAD_PATH = "/dashboard/morosidad";
const PAGOS_PATH = "/dashboard/pagos-realizados";

function fmt(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface FacturaMorosa {
  id_factura: number;
  id_socio: number;
  concepto: string;
  monto_base: number;
  monto_total: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado_pago: string;
  dni: string;
  nombres: string;
  apellidos: string;
  tipo_doc_siglas: string;
  interes_sbs: number;
  dias_mora: number;
}

interface FacturaPorVencer {
  id_factura: number;
  id_socio: number;
  concepto: string;
  monto_base: number;
  monto_total: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado_pago: string;
  dni: string;
  nombres: string;
  apellidos: string;
  tipo_doc_siglas: string;
  numero_cuota: number | null;
}

interface PagoRealizado {
  id_factura: number;
  id_socio: number;
  concepto: string;
  monto_base: number;
  monto_total: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_pago: string | null;
  dni: string;
  nombres: string;
  apellidos: string;
  tipo_doc_siglas: string;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export default function DashboardCobranza() {
  const { toast } = useToast();
  const location = useLocation();
  const isMorosidad = location.pathname.startsWith(MOROSIDAD_PATH);
  const isPagosRealizados = location.pathname.startsWith(PAGOS_PATH);

  // ─── BLOQUE 1: Facturas por vencer (Panel de Cobranza) ───────────────────
  const [porVencerList, setPorVencerList] = useState<FacturaPorVencer[]>([]);
  const [loadingPV, setLoadingPV] = useState(false);
  const [errorPV, setErrorPV] = useState<string | null>(null);
  const [pageSizePV, setPageSizePV] = useState(10);
  const [pagePV, setPagePV] = useState(1);
  const [searchPV, setSearchPV] = useState("");
  const [pFacturaIdPV, setPFacturaIdPV] = useState("");
  const [payingPV, setPayingPV] = useState(false);

  const totalPorVencer = porVencerList.reduce((acc, f) => acc + Number(f.monto_total), 0);
  const uniqueSociosPV = new Set(porVencerList.map((f) => f.id_socio)).size;

  const filteredListPV = useMemo(() => {
    const term = searchPV.trim().toLowerCase();
    if (!term) return porVencerList;
    return porVencerList.filter((f) =>
      `${f.nombres} ${f.apellidos} ${f.dni}`.toLowerCase().includes(term)
    );
  }, [porVencerList, searchPV]);

  const totalRecordsPV = filteredListPV.length;
  const totalPagesPV = Math.max(1, Math.ceil(totalRecordsPV / pageSizePV));

  useEffect(() => {
    if (pagePV > totalPagesPV) setPagePV(totalPagesPV);
  }, [totalPagesPV, pagePV]);

  const paginatedListPV = useMemo(() => {
    const start = (pagePV - 1) * pageSizePV;
    return filteredListPV.slice(start, start + pageSizePV);
  }, [filteredListPV, pagePV, pageSizePV]);

  const rangeStartPV = totalRecordsPV === 0 ? 0 : (pagePV - 1) * pageSizePV + 1;
  const rangeEndPV = Math.min(pagePV * pageSizePV, totalRecordsPV);

  const fetchPorVencer = async () => {
  setLoadingPV(true);
  setErrorPV(null);
  try {
    const res = await apiFetch("/api/cobranza/pendientes");
    if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar las facturas por vencer.`);
      const raw: { idFactura: number; idSocio: number; concepto: string; montoBase: number; totalAcumulado: number; fechaVencimiento: string; estadoPago: string }[] = await res.json();
      const data: FacturaPorVencer[] = raw.map((r) => ({
        id_factura: r.idFactura,
        id_socio: r.idSocio,
        concepto: r.concepto,
        monto_base: r.montoBase,
        monto_total: r.totalAcumulado,
        fecha_emision: "",
        fecha_vencimiento: r.fechaVencimiento,
        estado_pago: r.estadoPago,
        dni: "",
        nombres: `Socio #${r.idSocio}`,
        apellidos: "",
        tipo_doc_siglas: "",
        numero_cuota: null,
      }));
      setPorVencerList(data);
      setPagePV(1);
    } catch (err) {
      console.error(err);
      setErrorPV(err instanceof Error ? err.message : "Error al cargar facturas por vencer.");
    } finally {
      setLoadingPV(false);
    }
  };

  const handlePagoPV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pFacturaIdPV) return;
    setPayingPV(true);
    try {
      const res = await apiFetch(`/api/facturas/${pFacturaIdPV}/pagar`, {
  method: "PATCH",
});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.mensaje || "Error al registrar el pago.");
      }
      const result = await res.json();
      toast({
        title: "Pago anticipado registrado exitosamente",
        description: `Total Cobrado: S/ ${result.total_pagado.toFixed(2)} (sin interés moratorio, factura aún no vencida).`,
      });
      setPFacturaIdPV("");
      fetchPorVencer();
    } catch (err) {
      toast({
        title: "Error al registrar pago",
        description: err instanceof Error ? err.message : "Error al registrar pago.",
        variant: "destructive",
      });
    } finally {
      setPayingPV(false);
    }
  };

  const selectedInvoicePV = porVencerList.find((f) => String(f.id_factura) === pFacturaIdPV);

  // ─── BLOQUE 2: Facturas morosas / vencidas ───────────────────────────────
  const [morososList, setMorososList] = useState<FacturaMorosa[]>([]);
  const [loadingM, setLoadingM] = useState(false);
  const [errorM, setErrorM] = useState<string | null>(null);
  const [sbsRate, setSbsRate] = useState("1.0");
  const [pageSizeM, setPageSizeM] = useState(10);
  const [pageM, setPageM] = useState(1);
  const [searchM, setSearchM] = useState("");
  const [pFacturaIdM, setPFacturaIdM] = useState("");
  const [payingM, setPayingM] = useState(false);

  const totalAdeudado = morososList.reduce((acc, f) => acc + Number(f.monto_total), 0);
  const uniqueSociosM = new Set(morososList.map((f) => f.id_socio)).size;

  const filteredListM = useMemo(() => {
    const term = searchM.trim().toLowerCase();
    if (!term) return morososList;
    return morososList.filter((f) =>
      `${f.nombres} ${f.apellidos} ${f.dni}`.toLowerCase().includes(term)
    );
  }, [morososList, searchM]);

  const totalRecordsM = filteredListM.length;
  const totalPagesM = Math.max(1, Math.ceil(totalRecordsM / pageSizeM));

  useEffect(() => {
    if (pageM > totalPagesM) setPageM(totalPagesM);
  }, [totalPagesM, pageM]);

  const paginatedListM = useMemo(() => {
    const start = (pageM - 1) * pageSizeM;
    return filteredListM.slice(start, start + pageSizeM);
  }, [filteredListM, pageM, pageSizeM]);

  const rangeStartM = totalRecordsM === 0 ? 0 : (pageM - 1) * pageSizeM + 1;
  const rangeEndM = Math.min(pageM * pageSizeM, totalRecordsM);

  const fetchMorosos = async (rate?: string) => {
  setLoadingM(true);
  setErrorM(null);
  try {
    const targetRate = typeof rate === "string" ? rate : sbsRate;
    const res = await apiFetch(`/api/cobranza/vencidas?tasa_mensual=${targetRate}`);
    if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar los socios morosos.`);
      const raw: { idFactura: number; idSocio: number; concepto: string; montoBase: number; interesesCalculados: number; totalAcumulado: number; diasMora: number; estadoPago: string }[] = await res.json();
      const data: FacturaMorosa[] = raw.map((r) => ({
        id_factura: r.idFactura,
        id_socio: r.idSocio,
        concepto: r.concepto,
        monto_base: r.montoBase,
        monto_total: r.totalAcumulado,
        fecha_emision: "",
        fecha_vencimiento: "",
        estado_pago: r.estadoPago,
        dni: "",
        nombres: `Socio #${r.idSocio}`,
        apellidos: "",
        tipo_doc_siglas: "",
        interes_sbs: r.interesesCalculados,
        dias_mora: r.diasMora,
      }));
      setMorososList(data);
      setPageM(1);
    } catch (err) {
      console.error(err);
      setErrorM(err instanceof Error ? err.message : "Error al cargar morosos.");
    } finally {
      setLoadingM(false);
    }
  };

  const handlePagoM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pFacturaIdM) return;
    setPayingM(true);
    try {
     const res = await apiFetch(`/api/facturas/${pFacturaIdM}/pagar`, {
  method: "PATCH",
});
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.mensaje || "Error al registrar el pago.");
      }
      const result = await res.json();
      toast({
        title: "Pago registrado exitosamente",
        description: `Monto Base: S/ ${result.monto_base.toFixed(2)} | Interés SBS (${result.dias_mora} días): S/ ${result.interes_sbs.toFixed(2)} | Total Cobrado: S/ ${result.total_pagado.toFixed(2)}.`,
      });
      setPFacturaIdM("");
      fetchMorosos(sbsRate);
    } catch (err) {
      toast({
        title: "Error al registrar pago",
        description: err instanceof Error ? err.message : "Error al registrar pago.",
        variant: "destructive",
      });
    } finally {
      setPayingM(false);
    }
  };

  const selectedInvoiceM = morososList.find((f) => String(f.id_factura) === pFacturaIdM);

  // ─── BLOQUE 3: Pagos realizados ──────────────────────────────────────────
  const [pagosRealizadosList, setPagosRealizadosList] = useState<PagoRealizado[]>([]);
  const [loadingPR, setLoadingPR] = useState(false);
  const [errorPR, setErrorPR] = useState<string | null>(null);
  const [pageSizePR, setPageSizePR] = useState(10);
  const [pagePR, setPagePR] = useState(1);
  const [searchPR, setSearchPR] = useState("");

  const totalRecaudado = pagosRealizadosList.reduce((acc, p) => acc + Number(p.monto_total), 0);
  const uniqueSociosPR = new Set(pagosRealizadosList.map((p) => p.id_socio)).size;

  const filteredListPR = useMemo(() => {
    const term = searchPR.trim().toLowerCase();
    if (!term) return pagosRealizadosList;
    return pagosRealizadosList.filter((p) =>
      `${p.nombres} ${p.apellidos} ${p.dni}`.toLowerCase().includes(term)
    );
  }, [pagosRealizadosList, searchPR]);

  const totalRecordsPR = filteredListPR.length;
  const totalPagesPR = Math.max(1, Math.ceil(totalRecordsPR / pageSizePR));

  useEffect(() => {
    if (pagePR > totalPagesPR) setPagePR(totalPagesPR);
  }, [totalPagesPR, pagePR]);

  const paginatedListPR = useMemo(() => {
    const start = (pagePR - 1) * pageSizePR;
    return filteredListPR.slice(start, start + pageSizePR);
  }, [filteredListPR, pagePR, pageSizePR]);

  const rangeStartPR = totalRecordsPR === 0 ? 0 : (pagePR - 1) * pageSizePR + 1;
  const rangeEndPR = Math.min(pagePR * pageSizePR, totalRecordsPR);

  const fetchPagosRealizados = async () => {
  setLoadingPR(true);
  setErrorPR(null);
  try {
    const res = await apiFetch("/api/cobranza/historial");
    if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar el historial de pagos.`);
      const raw: { idFactura: number; idSocio: number; concepto: string; montoBase: number; totalAcumulado: number; fechaVencimiento: string }[] = await res.json();
      const data: PagoRealizado[] = raw.map((r) => ({
        id_factura: r.idFactura,
        id_socio: r.idSocio,
        concepto: r.concepto,
        monto_base: r.montoBase,
        monto_total: r.totalAcumulado,
        fecha_emision: "",
        fecha_vencimiento: r.fechaVencimiento,
        fecha_pago: null,
        dni: "",
        nombres: `Socio #${r.idSocio}`,
        apellidos: "",
        tipo_doc_siglas: "",
      }));
      setPagosRealizadosList(data);
      setPagePR(1);
    } catch (err) {
      setErrorPR(err instanceof Error ? err.message : "Error al cargar pagos realizados.");
    } finally {
      setLoadingPR(false);
    }
  };

  // ─── Carga inicial según vista activa ────────────────────────────────────
  useEffect(() => {
    if (isMorosidad) {
      fetchMorosos();
    } else if (isPagosRealizados) {
      fetchPagosRealizados();
    } else {
      fetchPorVencer();
    }
  }, [isMorosidad, isPagosRealizados]);

  // =========================================================================
  // VISTA: Gestión de Morosidad
  // =========================================================================
  if (isMorosidad) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Morosidad</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión de morosidad, cálculo automático de intereses SBS y recaudación de pagos en base de datos.
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchMorosos()} disabled={loadingM} className="gap-2">
            {loadingM && <Loader2 className="h-4 w-4 animate-spin" />}
            Actualizar Datos
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Moroso (Con Intereses)</p>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingM ? "Calculando..." : fmt(totalAdeudado)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-destructive/10">
                  <TrendingUp className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Socios con Deuda</p>
                  <p className="text-2xl font-bold text-foreground">{loadingM ? "..." : uniqueSociosM}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tasa SBS Aplicada</p>
                  <p className="text-2xl font-bold text-foreground">{sbsRate}% mensual</p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {errorM && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{errorM}</CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Facturas Vencidas con Cálculo de Intereses SBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Select value={String(pageSizeM)} onValueChange={(v) => { setPageSizeM(Number(v)); setPageM(1); }}>
                    <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span>registros</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Buscar:</span>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchM}
                      onChange={(e) => { setSearchM(e.target.value); setPageM(1); }}
                      placeholder="Nombre, apellido o DNI..."
                      className="h-8 w-[200px] rounded-md border border-input bg-transparent pl-7 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {loadingM ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Socio</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Intereses SBS</TableHead>
                      <TableHead className="text-right">Total Acumulado</TableHead>
                      <TableHead className="text-right">Mora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedListM.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          {totalRecordsM === 0 ? "No se encontraron deudas vencidas en la base de datos." : "Ningún registro coincide con la búsqueda."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedListM.map((f) => (
                        <TableRow key={f.id_factura}>
                          <TableCell className="font-medium">
                            <span className="block text-sm font-semibold">{f.nombres} {f.apellidos}</span>
                            <span className="block text-[10px] text-muted-foreground">{f.tipo_doc_siglas}: {f.dni}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{f.concepto}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(f.monto_base)}</TableCell>
                          <TableCell className="text-right text-red-600 font-semibold">{fmt(f.interes_sbs)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(f.monto_total)}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-red-600 text-white select-none whitespace-nowrap">
                              <Ban className="h-3 w-3 mr-1" /> {f.dias_mora} días
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {!loadingM && totalRecordsM > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Mostrando registros del {rangeStartM} al {rangeEndM} de un total de {totalRecordsM} registros
                    {searchM && ` (filtrados de ${morososList.length} en total)`}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPageM((p) => Math.max(1, p - 1))} disabled={pageM === 1}>Anterior</Button>
                    <span className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium">{pageM}</span>
                    <span className="text-xs text-muted-foreground px-1">de {totalPagesM}</span>
                    <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPageM((p) => Math.min(totalPagesM, p + 1))} disabled={pageM === totalPagesM}>Siguiente</Button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-3 italic">
                * Nota: El bloqueo de zarpes de naves a socios morosos se realiza en tiempo real a nivel del Backend API al intentar solicitar o autorizar salidas.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  Configurar Tasa SBS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tasa-sbs" className="text-xs font-semibold text-slate-700">Tasa Mensual (%)</Label>
                  <div className="flex gap-2">
                    <input
                      id="tasa-sbs"
                      type="number"
                      step="0.01"
                      min="0"
                      value={sbsRate}
                      onChange={(e) => setSbsRate(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Button type="button" onClick={() => fetchMorosos(sbsRate)} disabled={loadingM} size="sm" className="bg-primary text-primary-foreground select-none">Aplicar</Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Configure la tasa de interés mensual utilizada para calcular la morosidad y al procesar los cobros.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Cobrar Factura Vencida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePagoM} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Socio y Recibo</Label>
                    <Select value={pFacturaIdM} onValueChange={setPFacturaIdM}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingM ? "Cargando morosos..." : "Seleccionar recibo"} />
                      </SelectTrigger>
                      <SelectContent>
                        {morososList.map((f) => (
                          <SelectItem key={f.id_factura} value={String(f.id_factura)}>
                            {f.nombres} {f.apellidos} - Factura #{f.id_factura} (S/ {f.monto_total.toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {pFacturaIdM && selectedInvoiceM && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                      <p className="text-muted-foreground">
                        Deuda Principal: <span className="font-semibold text-slate-800">{fmt(selectedInvoiceM.monto_base)}</span>
                      </p>
                      <p className="text-red-600 font-semibold">
                        Interés SBS Mora: {fmt(selectedInvoiceM.interes_sbs)} ({selectedInvoiceM.dias_mora} días)
                      </p>
                      <div className="pt-2 mt-1 border-t border-slate-200 font-bold text-sm text-slate-900 flex justify-between">
                        <span>Total a Recaudar:</span>
                        <span>{fmt(selectedInvoiceM.monto_total)}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                    disabled={!pFacturaIdM || payingM}
                  >
                    {payingM ? (<><Loader2 className="h-4 w-4 animate-spin" />Procesando Cobro...</>) : (<><CreditCard className="h-4 w-4" /> Registrar Recaudación</>)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VISTA: Pagos Realizados
  // =========================================================================
  if (isPagosRealizados) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pagos Realizados</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Historial de facturas cobradas con detalle de montos e intereses SBS aplicados.
            </p>
          </div>
          <Button variant="outline" onClick={fetchPagosRealizados} disabled={loadingPR} className="gap-2">
            {loadingPR && <Loader2 className="h-4 w-4 animate-spin" />}
            Actualizar Datos
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Recaudado</p>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingPR ? "Calculando..." : fmt(totalRecaudado)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Socios que Pagaron</p>
                  <p className="text-2xl font-bold text-foreground">{loadingPR ? "..." : uniqueSociosPR}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Users2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {errorPR && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{errorPR}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Historial de Pagos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select value={String(pageSizePR)} onValueChange={(v) => { setPageSizePR(Number(v)); setPagePR(1); }}>
                  <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
                <span>registros</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Buscar:</span>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchPR}
                    onChange={(e) => { setSearchPR(e.target.value); setPagePR(1); }}
                    placeholder="Nombre, apellido o DNI..."
                    className="h-8 w-[200px] rounded-md border border-input bg-transparent pl-7 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>

            {loadingPR ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto Base</TableHead>
                    <TableHead className="text-right">Total Cobrado</TableHead>
                    <TableHead className="text-right">Tipo</TableHead>
                    <TableHead className="text-right">Fecha de Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedListPR.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        {totalRecordsPR === 0 ? "No hay pagos registrados aún." : "Ningún registro coincide con la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedListPR.map((p) => {
                      const conMora = p.monto_total > p.monto_base;
                      return (
                        <TableRow key={p.id_factura}>
                          <TableCell className="font-medium">
                            <span className="block text-sm font-semibold">{p.nombres} {p.apellidos}</span>
                            <span className="block text-[10px] text-muted-foreground">{p.tipo_doc_siglas}: {p.dni}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.concepto}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(p.monto_base)}</TableCell>
                          <TableCell className="text-right font-bold">{fmt(p.monto_total)}</TableCell>
                          <TableCell className="text-right">
                            {conMora ? (
                              <Badge className="bg-red-100 text-red-700 border border-red-200 select-none whitespace-nowrap">
                                <Ban className="h-3 w-3 mr-1" /> Con mora
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 select-none whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Anticipado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-PE") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {!loadingPR && totalRecordsPR > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Mostrando registros del {rangeStartPR} al {rangeEndPR} de un total de {totalRecordsPR} registros
                  {searchPR && ` (filtrados de ${pagosRealizadosList.length} en total)`}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPagePR((p) => Math.max(1, p - 1))} disabled={pagePR === 1}>Anterior</Button>
                  <span className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium">{pagePR}</span>
                  <span className="text-xs text-muted-foreground px-1">de {totalPagesPR}</span>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPagePR((p) => Math.min(totalPagesPR, p + 1))} disabled={pagePR === totalPagesPR}>Siguiente</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // VISTA: Panel de Cobranza (facturas por vencer / pago anticipado)
  // =========================================================================
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Cobranza</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Facturas pendientes próximas a vencer y registro de pagos anticipados.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchPorVencer()} disabled={loadingPV} className="gap-2">
          {loadingPV && <Loader2 className="h-4 w-4 animate-spin" />}
          Actualizar Datos
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Pendiente por Vencer</p>
                <p className="text-2xl font-bold text-foreground">
                  {loadingPV ? "Calculando..." : fmt(totalPorVencer)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Socios con Facturas Vigentes</p>
                <p className="text-2xl font-bold text-foreground">{loadingPV ? "..." : uniqueSociosPV}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {errorPV && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{errorPV}</CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Facturas Pendientes por Vencer (Pago Anticipado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select value={String(pageSizePV)} onValueChange={(v) => { setPageSizePV(Number(v)); setPagePV(1); }}>
                  <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
                <span>registros</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Buscar:</span>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchPV}
                    onChange={(e) => { setSearchPV(e.target.value); setPagePV(1); }}
                    placeholder="Nombre, apellido o DNI..."
                    className="h-8 w-[200px] rounded-md border border-input bg-transparent pl-7 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>

            {loadingPV ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Vence el</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedListPV.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        {totalRecordsPV === 0 ? "No hay facturas pendientes por vencer." : "Ningún registro coincide con la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedListPV.map((f) => (
                      <TableRow key={f.id_factura}>
                        <TableCell className="font-medium">
                          <span className="block text-sm font-semibold">{f.nombres} {f.apellidos}</span>
                          <span className="block text-[10px] text-muted-foreground">{f.tipo_doc_siglas}: {f.dni}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {f.concepto}{f.numero_cuota ? ` (Cuota ${f.numero_cuota})` : ""}
                        </TableCell>
                        <TableCell className="text-right font-bold">{fmt(f.monto_total)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {new Date(f.fecha_vencimiento).toLocaleDateString("es-PE")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-emerald-600 text-white select-none whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Vigente
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {!loadingPV && totalRecordsPV > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Mostrando registros del {rangeStartPV} al {rangeEndPV} de un total de {totalRecordsPV} registros
                  {searchPV && ` (filtrados de ${porVencerList.length} en total)`}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPagePV((p) => Math.max(1, p - 1))} disabled={pagePV === 1}>Anterior</Button>
                  <span className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium">{pagePV}</span>
                  <span className="text-xs text-muted-foreground px-1">de {totalPagesPV}</span>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3" onClick={() => setPagePV((p) => Math.min(totalPagesPV, p + 1))} disabled={pagePV === totalPagesPV}>Siguiente</Button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground mt-3 italic">
              * Nota: Estas facturas aún no han vencido, por lo que no generan interés moratorio SBS. El pago se registra por el monto base.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Cobrar Factura Anticipada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePagoPV} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Socio y Recibo</Label>
                  <Select value={pFacturaIdPV} onValueChange={setPFacturaIdPV}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingPV ? "Cargando facturas..." : "Seleccionar recibo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {porVencerList.map((f) => (
                        <SelectItem key={f.id_factura} value={String(f.id_factura)}>
                          {f.nombres} {f.apellidos} - Factura #{f.id_factura} (S/ {f.monto_total.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {pFacturaIdPV && selectedInvoicePV && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                    <p className="text-muted-foreground">
                      Monto Base: <span className="font-semibold text-slate-800">{fmt(selectedInvoicePV.monto_base)}</span>
                    </p>
                    <p className="text-emerald-600 font-semibold">Sin interés moratorio (factura no vencida)</p>
                    <div className="pt-2 mt-1 border-t border-slate-200 font-bold text-sm text-slate-900 flex justify-between">
                      <span>Total a Recaudar:</span>
                      <span>{fmt(selectedInvoicePV.monto_total)}</span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                  disabled={!pFacturaIdPV || payingPV}
                >
                  {payingPV ? (<><Loader2 className="h-4 w-4 animate-spin" />Procesando Cobro...</>) : (<><CreditCard className="h-4 w-4" /> Registrar Recaudación</>)}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
