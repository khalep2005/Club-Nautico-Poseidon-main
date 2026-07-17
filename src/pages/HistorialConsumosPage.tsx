import { useState, useEffect } from "react";
import { CreditCard, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";

interface ConsumoFlatAPI {
  idConsumo: number;
  idSocio: number;
  servicio: string;
  monto: number;
  descripcion: string;
  fechaConsumo: string;
}

interface ConsumoPlano {
  id_consumo: number;
  dni: string;
  tipo_doc_siglas: string;
  nombre_completo: string;
  fecha: string;
  servicio: string;
  monto: number;
}

const OPCIONES_POR_PAGINA = [10, 25, 50, 100];

export default function HistorialConsumosPage() {
  const [consumosList, setConsumosList] = useState<ConsumoPlano[]>([]);
  const [cargandoConsumos, setCargandoConsumos] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // ── Estado de paginación ─────────────────────────────────────────────────
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  const fetchConsumos = async () => {
  setCargandoConsumos(true);
  try {
    const res = await apiFetch("/api/consumos");
    if (!res.ok) return;
    const data: ConsumoFlatAPI[] = await res.json();

    // Nota: ms-facturacion no conoce el nombre/dni del socio (vive en ms-socios,
    // otro microservicio con su propia base de datos), por eso se usa un
    // placeholder "Socio #N" -- mismo patrón usado en FacturacionPage.tsx.
    const flatList: ConsumoPlano[] = data.map((c) => ({
      id_consumo: c.idConsumo,
      dni: "",
      tipo_doc_siglas: "DNI",
      nombre_completo: `Socio #${c.idSocio}`,
      fecha: c.fechaConsumo,
      servicio: c.servicio,
      monto: c.monto,
    }));
    setConsumosList(flatList);
  } catch (err: unknown) {
    console.error("Error al obtener historial de consumos:", err);
  } finally {
    setCargandoConsumos(false);
  }
};

  useEffect(() => {
    fetchConsumos();
  }, []);

  const consumosFiltrados = consumosList.filter((c) => {
    return `${c.nombre_completo} ${c.dni}`.toLowerCase().includes(busqueda.toLowerCase());
  });

  const totalConsumosMonto = consumosFiltrados.reduce((acc, curr) => acc + curr.monto, 0);

  // ── Cálculos de paginación ──────────────────────────────────────────────
  const totalRegistros = consumosFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina));

  // Si la búsqueda reduce los resultados y la página actual queda fuera de rango,
  // volvemos automáticamente a la página 1 para no mostrar una tabla vacía.
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, registrosPorPagina]);

  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const indiceFin = Math.min(indiceInicio + registrosPorPagina, totalRegistros);
  const consumosPaginados = consumosFiltrados.slice(indiceInicio, indiceFin);

  const irAPagina = (pagina: number) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaActual(pagina);
  };

  // Genera una lista corta de números de página alrededor de la actual,
  // para no mostrar 50 botones si hay muchas páginas.
  const numerosDePagina = () => {
    const paginas: number[] = [];
    const inicio = Math.max(1, paginaActual - 2);
    const fin = Math.min(totalPaginas, inicio + 4);
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de Consumo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualización y seguimiento general de todos los consumos y servicios realizados por los socios.
          </p>
        </div>
        <Button variant="outline" onClick={fetchConsumos} disabled={cargandoConsumos} className="gap-2">
          {cargandoConsumos && <Loader2 className="h-4 w-4 animate-spin" />}
          Actualizar Datos
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Monto Total Histórico</p>
                <p className="text-2xl font-bold text-foreground">
                  {cargandoConsumos ? "Calculando..." : `S/ ${totalConsumosMonto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <CreditCard className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total de Consumos Registrados</p>
                <p className="text-2xl font-bold text-foreground">
                  {cargandoConsumos ? "..." : totalRegistros}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Search className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de búsqueda + selector de registros por página */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por socio o DNI..."
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Mostrar</span>
          <Select
            value={String(registrosPorPagina)}
            onValueChange={(val) => setRegistrosPorPagina(Number(val))}
          >
            <SelectTrigger className="w-20 h-9">
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
      </div>

      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/20 dark:bg-slate-950/20">
              <TableRow className="border-b border-slate-200 dark:border-slate-800">
                <TableHead className="font-bold text-xs pl-6 py-3">Documento de Titular</TableHead>
                <TableHead className="font-bold text-xs">Nombre y Apellido</TableHead>
                <TableHead className="font-bold text-xs">Fecha</TableHead>
                <TableHead className="font-bold text-xs">Servicio</TableHead>
                <TableHead className="font-bold text-xs text-right pr-6">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoConsumos ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 dark:text-slate-500 py-10 text-sm">
                    Cargando historial completo de consumos...
                  </TableCell>
                </TableRow>
              ) : consumosPaginados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-10 text-sm">
                    No se han registrado consumos en la base de datos.
                  </TableCell>
                </TableRow>
              ) : (
                consumosPaginados.map((c) => (
                  <TableRow key={c.id_consumo} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <TableCell className="font-mono text-xs pl-6 py-4">
                      <span className="text-slate-400 mr-1.5 font-bold">{c.tipo_doc_siglas}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{c.dni}</span>
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-slate-900 dark:text-slate-100">{c.nombre_completo}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(c.fecha).toLocaleDateString("es-PE")}
                    </TableCell>
                    <TableCell className="text-sm text-slate-750 dark:text-slate-300 font-medium">
                      {c.servicio}
                    </TableCell>
                    <TableCell className="text-right pr-6 font-bold text-slate-900 dark:text-slate-100">
                      {`S/ ${Number(c.monto).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Barra de paginación ────────────────────────────────────── */}
          {!cargandoConsumos && totalRegistros > 0 && (
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
