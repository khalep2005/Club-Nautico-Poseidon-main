import { useState, useEffect } from "react";
import { DollarSign, Receipt, FileCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/apiClient"; 
// ===================================================================
// "Inicio" para el rol Finanzas: resumen ejecutivo con KPIs y gráfica.
// El detalle completo (Estados de Cuenta, Consumos Pendientes,
// Fraccionamiento de Deuda) vive en FacturacionPage.tsx ("Panel
// Financiero" en el menú lateral).
// ===================================================================

interface Kpis {
  pendiente_facturar: number;
  facturado_por_cobrar: number;
  morosidad_total: number;
}

interface GraficaItem {
  nombre: string;
  valor: number;
}

interface DashboardData {
  kpis: Kpis;
  graficaDistribucion: GraficaItem[];
}

// Colores por nombre de categoría (estricto, sin depender del orden de la API)
const COLORS_MAP: Record<string, string> = {
  "Por Cobrar (A tiempo)": "#3b82f6", // Azul
  "Morosidad":             "#ef4444", // Rojo
  "Deuda Fraccionada":     "#f59e0b", // Naranja
};

function fmt(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Tooltip personalizado
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: GraficaItem }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-2.5 shadow-lg text-sm">
      <p className="font-semibold text-foreground">{item.payload.nombre}</p>
      <p className="text-muted-foreground mt-0.5">{fmt(item.value)}</p>
    </div>
  );
}

// Leyenda personalizada
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

const KPI_LOADING = "…";

export default function DashboardFinanzas() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
  setCargando(true);
  setError(null);
  try {
    const res = await apiFetch("/api/facturas/dashboard");
    if (!res.ok) throw new Error(`Error ${res.status} al cargar el dashboard.`);
    const json: DashboardData = await res.json();
    setData(json);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error inesperado.");
  } finally {
    setCargando(false);
  }
};
    fetchDashboard();
  }, []);

  const kpis = data?.kpis;
  const grafica = data?.graficaDistribucion ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de Finanzas</h1>
        <p className="text-muted-foreground text-sm">
          Resumen general del estado financiero del Club
        </p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pendiente de Facturar</p>
                <p className="text-2xl font-bold text-foreground">
                  {cargando ? KPI_LOADING : fmt(kpis?.pendiente_facturar ?? 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Facturado por Cobrar</p>
                <p className="text-2xl font-bold text-foreground">
                  {cargando ? KPI_LOADING : fmt(kpis?.facturado_por_cobrar ?? 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Morosidad Total</p>
                <p className="text-2xl font-bold text-red-600">
                  {cargando ? KPI_LOADING : fmt(kpis?.morosidad_total ?? 0)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/10">
                <Users className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfica de distribución financiera ── */}
      {!cargando && !error && grafica.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Distribución Financiera
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Desglose del estado actual de las cuentas del club
            </p>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={grafica}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  paddingAngle={3}
                  stroke="none"
                >
                  {grafica.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS_MAP[entry.nombre] || "#8884d8"}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Error de carga de gráfica ── */}
      {error && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Acceso rápido ── */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-6 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 shrink-0">
            <FileCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">¿Listo para facturar el mes?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ve a <span className="font-medium">Panel Financiero</span> para revisar el detalle de
              consumos pendientes por socio y generar la facturación mensual.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
