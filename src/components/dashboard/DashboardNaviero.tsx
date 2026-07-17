import { useState, useEffect } from "react";
import { Ship, Navigation, AlertTriangle, Anchor, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient"; 
function estadoZarpeBadge(estado: string) {
  switch (estado) {
    case "Aprobado":
      return <Badge className="bg-success text-success-foreground hover:bg-success/90">Aprobado</Badge>;
    case "Rechazado":
      return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Rechazado</Badge>;
    default:
      return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Pendiente</Badge>;
  }
}

interface DashboardData {
  kpis: {
    embarcaciones: number;
    zarpes: number;
    validaciones_pendientes: number;
  };
  ultimosZarpes: {
    id_zarpe: number;
    embarcacion: string;
    socio: string;
    destino: string;
    fecha_salida: string;
    hora_salida: string;
    hora_retorno: string;
    estado: string;
  }[];
}

export default function DashboardNaviero() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      const response = await apiFetch("/api/nautica/dashboard/naviero");

      if (!response.ok) {
        throw new Error("Error al obtener los datos del dashboard");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  fetchDashboardData();
}, []);

  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    return timeString.slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        {error}
      </div>
    );
  }

  const kpis = data?.kpis || { embarcaciones: 0, zarpes: 0, validaciones_pendientes: 0 };
  const ultimosZarpes = data?.ultimosZarpes || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel Naviero</h1>
        <p className="text-muted-foreground text-sm">Control de embarcaciones y zarpes del club</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Embarcaciones</p>
                <p className="text-2xl font-bold text-foreground">{kpis.embarcaciones}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Ship className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Zarpes Registrados</p>
                <p className="text-2xl font-bold text-foreground">{kpis.zarpes}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-success/10">
                <Navigation className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Validaciones Pendientes</p>
                <p className="text-2xl font-bold text-foreground">{kpis.validaciones_pendientes}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de últimos zarpes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Anchor className="h-4 w-4 text-muted-foreground" />
            Últimos Zarpes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embarcación</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Fecha Salida</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimosZarpes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No hay zarpes registrados.
                  </TableCell>
                </TableRow>
              ) : (
                ultimosZarpes.map((z) => (
                  <TableRow key={z.id_zarpe}>
                    <TableCell className="font-medium">{z.embarcacion}</TableCell>
                    <TableCell>{z.socio}</TableCell>
                    <TableCell>{z.destino}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(z.fecha_salida).toLocaleDateString()} {formatTime(z.hora_salida)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatTime(z.hora_retorno)}</TableCell>
                    <TableCell>{estadoZarpeBadge(z.estado)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
