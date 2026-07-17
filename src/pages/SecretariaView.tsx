import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  ClipboardList, Users, AlertTriangle, Eye, FileText, 
  CreditCard, Search, Filter, ChevronLeft, ChevronRight, SlidersHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import ModalNuevaSolicitud from "@/components/ModalNuevaSolicitud";
import { apiFetch } from "@/lib/apiClient";

interface SolicitudAPI {
  id_solicitud: number;
  dni: string;
  tipo_doc_siglas?: string;
  nombres: string;
  apellidos: string;
  clasificacion: string;
  estado: string;
  fecha_creacion: string;
  observacion: string | null;
}

interface ConsumoDetalle {
  id_consumo: number;
  servicio: string;
  monto: number;
  descripcion: string;
  fecha_consumo: string;
}

interface SocioConsumosAPI {
  id_socio: number;
  dni: string;
  tipo_doc_siglas: string;
  nombres: string;
  apellidos: string;
  total_consumos: number;
  consumos: ConsumoDetalle[];
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

// ── Disponibilidad de servicios (manual, controlada por Secretaría) ────────
interface DisponibilidadServicio {
  disponible: boolean;
  motivo: string | null;
}

const OPCIONES_POR_PAGINA = [5, 10, 25, 50];

// ── Configuración de validación por tipo de documento (Registrar Servicio) ─
const LIMITE_DOC_SERVICIO: Record<string, number> = { DNI: 8, CE: 9, PAS: 12 };
const REGEX_DOC_SERVICIO: Record<string, RegExp> = {
  DNI: /^[0-9]*$/,       // solo números
  CE: /^[0-9]*$/,        // solo números (sin letras)
  PAS: /^[a-zA-Z0-9]*$/, // alfanumérico
};

// ── Lista maestra de servicios (misma agrupación que en el <select>) ───────
// Se usa tanto para renderizar el <select> como el panel de gestión de
// disponibilidad, así solo hay que mantener un solo lugar con la lista.
const GRUPOS_SERVICIOS: { grupo: string; items: { valor: string; label: string }[] }[] = [
  {
    grupo: "Servicios Náuticos",
    items: [
      { valor: "Anclaje / Amarre", label: "Anclaje / Radas y Amarres" },
      { valor: "Uso de Rampa / Grúa", label: "Uso de Rampa y Grúa" },
      { valor: "Cabotaje", label: "Cabotaje" },
      { valor: "Traslado de Nave", label: "Traslado de Nave" },
    ],
  },
  {
    grupo: "Instalaciones del Club",
    items: [
      { valor: "Piscinas", label: "Piscinas" },
      { valor: "Salón de Relajación", label: "Salón de Relajación" },
      { valor: "Cafetería", label: "Cafetería" },
      { valor: "Salón de Fiestas", label: "Salón de Fiestas" },
    ],
  },
  {
    grupo: "Instrucción y Escuela",
    items: [
      { valor: "Escuela de Navegación", label: "Cursos Escuela de Navegación" },
      { valor: "Instructor de Natación", label: "Instructor de Natación" },
      { valor: "Instructor de Buceo", label: "Instructor de Buceo" },
    ],
  },
  {
    grupo: "Servicios Adicionales",
    items: [
      { valor: "Limpieza de Nave", label: "Limpieza de Nave" },
      // "Otros" queda fuera: siempre disponible, no tiene sentido deshabilitarlo
    ],
  },
];

export default function SecretariaView() {
  
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");

 
  const [solicitudes, setSolicitudes] = useState<SolicitudAPI[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  //  Estado de paginación (tabla de Solicitudes en curso) 
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  
  const [metricas, setMetricas] = useState({
    solicitudesEnEspera: 0,
    sociosActivos: 0,
    alertas: 0,
  });

  // Modales
  const [motivoDialog, setMotivoDialog] = useState(false);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<string>("");
  const [servicioDialog, setServicioDialog] = useState(false);

  // Formulario de Servicio
  const [tipoDocServicio, setTipoDocServicio] = useState("DNI");
  const [dniSocioServicio, setDniSocioServicio] = useState("");
  const [categoriaServicio, setCategoriaServicio] = useState("Anclaje / Amarre");
  const [montoServicio, setMontoServicio] = useState("");
  const [descripcionServicio, setDescripcionServicio] = useState("");
  const [nombreInstructor, setNombreInstructor] = useState("");
  const [guardandoServicio, setGuardandoServicio] = useState(false);

  // Búsqueda de socio por documento 
  const [socioEncontrado, setSocioEncontrado] = useState<{ nombres: string; apellidos: string; clasificacion: string } | null>(null);
  const [buscandoSocio, setBuscandoSocio] = useState(false);
  const [errorBusquedaSocio, setErrorBusquedaSocio] = useState<string | null>(null);

  // Detecta si el servicio elegido corresponde a un instructor 
  const esServicioInstructor =
    categoriaServicio === "Instructor de Natación" ||
    categoriaServicio === "Instructor de Buceo" ||
    categoriaServicio === "Escuela de Navegación";

  // Precios preestablecidos por servicio 
  const [preciosServicios, setPreciosServicios] = useState<Record<string, number>>({});
  const [cargandoPrecios, setCargandoPrecios] = useState(false);

  // ── Disponibilidad de servicios (nuevo) ───────────────────────────────────
  const [disponibilidadServicios, setDisponibilidadServicios] = useState<Record<string, DisponibilidadServicio>>({});
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [disponibilidadDialog, setDisponibilidadDialog] = useState(false);
  const [guardandoServicioKey, setGuardandoServicioKey] = useState<string | null>(null);
  const [motivoInputs, setMotivoInputs] = useState<Record<string, string>>({});

  // Un servicio se considera disponible por defecto si no hay registro guardado
  const esServicioDisponible = (servicio: string) =>
    disponibilidadServicios[servicio]?.disponible !== false;

  //   PRECIOS DE SERVICIOS
  const fetchPreciosServicios = async () => {
    setCargandoPrecios(true);
    try {
      const res = await apiFetch("/api/consumos/precios");
      if (!res.ok) return;
      const data: { servicio: string; monto: number }[] = await res.json();
      const mapa: Record<string, number> = {};
      data.forEach((item) => { mapa[item.servicio] = item.monto; });
      setPreciosServicios(mapa);
    } catch {
      
    } finally {
      setCargandoPrecios(false);
    }
  };

  // ── DISPONIBILIDAD DE SERVICIOS: cargar estado actual ────────────────────
  const fetchDisponibilidadServicios = async () => {
    setCargandoDisponibilidad(true);
    try {
      const res = await apiFetch("/api/consumos/disponibilidad");
      if (!res.ok) return;
      const data: { servicio: string; disponible: boolean; motivo: string | null }[] = await res.json();
      const mapa: Record<string, DisponibilidadServicio> = {};
      data.forEach((item) => {
        mapa[item.servicio] = { disponible: item.disponible, motivo: item.motivo };
      });
      setDisponibilidadServicios(mapa);
    } catch {
      // Si falla, se asume que todos los servicios están disponibles (comportamiento por defecto)
    } finally {
      setCargandoDisponibilidad(false);
    }
  };

  // ── DISPONIBILIDAD DE SERVICIOS: alternar disponible/no disponible ───────
  const handleToggleDisponibilidad = async (servicio: string) => {
    const disponibleActual = esServicioDisponible(servicio);
    const nuevoValor = !disponibleActual;
    const motivo = motivoInputs[servicio]?.trim() || null;

    setGuardandoServicioKey(servicio);
    try {
      const res = await apiFetch(`/api/consumos/disponibilidad/${encodeURIComponent(servicio)}`, {
        method: "PUT",
        body: JSON.stringify({ disponible: nuevoValor, motivo }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la disponibilidad.");

      setDisponibilidadServicios((prev) => ({
        ...prev,
        [servicio]: { disponible: nuevoValor, motivo },
      }));

      toast.success(nuevoValor ? "Servicio habilitado" : "Servicio deshabilitado", {
        description: servicio,
      });

      // Si el servicio recién deshabilitado era el seleccionado en "Registrar Servicio", lo reseteamos
      if (!nuevoValor && categoriaServicio === servicio) {
        setCategoriaServicio("Otros");
      }
    } catch (err) {
      toast.error("Error al actualizar disponibilidad", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setGuardandoServicioKey(null);
    }
  };

  //  BUSCAR SOCIO POR DOCUMENTO 
  const buscarSocioPorDocumento = async (tipoDoc: string, numero: string) => {
    if (!numero.trim()) {
      setSocioEncontrado(null);
      setErrorBusquedaSocio(null);
      return;
    }
    setBuscandoSocio(true);
    setSocioEncontrado(null);
    setErrorBusquedaSocio(null);
    try {
      const res = await apiFetch(`/api/socios/buscar?tipo_doc=${tipoDoc}&numero=${numero}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorBusquedaSocio(data.mensaje || "No se encontró un socio con ese documento.");
        return;
      }
      setSocioEncontrado(data);
    } catch {
      setErrorBusquedaSocio("Error de red al buscar el socio.");
    } finally {
      setBuscandoSocio(false);
    }
  };

  // CONSULTA AL BACKEND: MÉTRICAS
  const fetchMetricas = async () => {
    try {
      const res = await apiFetch("/api/dashboard/secretaria");
      if (!res.ok) return;
      const data = await res.json();
      setMetricas({
        solicitudesEnEspera: data.solicitudesEnEspera ?? 0,
        sociosActivos: data.sociosActivos ?? 0,
        alertas: data.alertas ?? 0,
      });
    } catch {  }
  };

  //   LISTAR SOLICITUDES
  const fetchSolicitudes = async () => {
    setCargandoLista(true);
    setErrorLista(null);
    try {
      const res = await apiFetch("/api/solicitudes");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar las solicitudes.`);
      const data: SolicitudAPI[] = await res.json();
      setSolicitudes(data);
    } catch (err: unknown) {
      setErrorLista(err instanceof Error ? err.message : "Error inesperado en la red.");
    } finally {
      setCargandoLista(false);
    }
  };



  useEffect(() => {
    fetchMetricas();
    fetchSolicitudes();
    fetchPreciosServicios();
    fetchDisponibilidadServicios();
  }, []);

  //  AUTOCOMPLETAR MONTO 
  useEffect(() => {
    if (categoriaServicio === "Otros") return; // se ingresa manualmente
    if (preciosServicios[categoriaServicio] !== undefined) {
      setMontoServicio(String(preciosServicios[categoriaServicio]));
    } else {
      setMontoServicio("");
    }
  }, [categoriaServicio, preciosServicios]);

  //  LIMPIAR NOMBRE DE INSTRUCTOR SI EL SERVICIO CAMBIA A UNO QUE NO LO REQUIERE 
  useEffect(() => {
    if (!esServicioInstructor) {
      setNombreInstructor("");
    }
  }, [esServicioInstructor]);

  //  LÓGICA DE FILTRADO EN TIEMPO REAL
  const solicitudesFiltradas = solicitudes.filter((s) => {
    const matchTexto = `${s.nombres} ${s.apellidos} ${s.dni}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === "Todos" || s.estado === filtroEstado;
    return matchTexto && matchEstado;
  });

  // Cálculos de paginación 
  const totalRegistros = solicitudesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina));

  // Si la búsqueda/filtro reduce los resultados y la página actual queda fuera
  // de rango, volvemos automáticamente a la página 1.
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroEstado, registrosPorPagina]);

  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const indiceFin = Math.min(indiceInicio + registrosPorPagina, totalRegistros);
  const solicitudesPaginadas = solicitudesFiltradas.slice(indiceInicio, indiceFin);

  const irAPagina = (pagina: number) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaActual(pagina);
  };

  // Genera una lista corta de números de página alrededor de la actual.
  const numerosDePagina = () => {
    const paginas: number[] = [];
    const inicio = Math.max(1, paginaActual - 2);
    const fin = Math.min(totalPaginas, inicio + 4);
    for (let i = inicio; i <= fin; i++) paginas.push(i);
    return paginas;
  };

  // Filtra caracteres no permitidos mientras se escribe, según el tipo de doc actual
  const handleChangeDniServicio = (valor: string) => {
    const mayus = valor.toUpperCase();
    const regex = REGEX_DOC_SERVICIO[tipoDocServicio] ?? /^[a-zA-Z0-9]*$/;
    const limite = LIMITE_DOC_SERVICIO[tipoDocServicio] ?? 12;
    if ((mayus === "" || regex.test(mayus)) && mayus.length <= limite) {
      setDniSocioServicio(mayus);
      setSocioEncontrado(null);
      setErrorBusquedaSocio(null);
    }
  };

  // Al cambiar el tipo de documento, limpia/recorta el valor actual si ya
  // no es compatible con el nuevo tipo, y relanza la búsqueda del socio
  const handleChangeTipoDocServicio = (valor: string) => {
    setTipoDocServicio(valor);
    const limite = LIMITE_DOC_SERVICIO[valor] ?? 12;
    let valorLimpio = dniSocioServicio;
    setDniSocioServicio((prev) => {
      valorLimpio = (valor === "DNI" || valor === "CE")
        ? prev.replace(/\D/g, "")
        : prev.replace(/[^a-zA-Z0-9]/g, "");
      valorLimpio = valorLimpio.slice(0, limite);
      return valorLimpio;
    });
    setSocioEncontrado(null);
    setErrorBusquedaSocio(null);
    if (dniSocioServicio.trim()) buscarSocioPorDocumento(valor, dniSocioServicio);
  };

  //  ENVÍO AL BACKEND CARGAR CONSUMO 
  const handleRegistrarServicioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (esServicioInstructor && !nombreInstructor.trim()) {
      alert("Por favor ingrese el nombre del instructor que brindó el servicio.");
      return;
    }

    if (!socioEncontrado) {
      alert("Busca y selecciona un socio válido antes de registrar el servicio.");
      return;
    }

    setGuardandoServicio(true);
    try {
      const descripcionFinal = esServicioInstructor
        ? `Instructor: ${nombreInstructor}${descripcionServicio ? " — " + descripcionServicio : ""}`
        : descripcionServicio || `Cargo por servicio de ${categoriaServicio}`;

      // ConsumoRequest.java (ms-facturacion) espera camelCase, a diferencia de
      // solicitudes/retiros que usan snake_case -- este endpoint ya existía
      // antes de hoy y no se tocó, por eso el formato es distinto.
      const res = await apiFetch("/api/consumos", {
        method: "POST",
        body: JSON.stringify({
          idSocio: socioEncontrado.idSocio,
          servicio: categoriaServicio,
          monto: parseFloat(montoServicio),
          descripcion: descripcionFinal,
          estado: "PENDIENTE",
        }),
      });

      if (!res.ok) throw new Error("No se pudo insertar el cargo.");

      toast.success("Servicio registrado exitosamente", {
        description: "El cargo ha sido añadido al estado de cuenta del socio.",
      });
      setServicioDialog(false);
      setTipoDocServicio("DNI");
      setSocioEncontrado(null);
      setErrorBusquedaSocio(null);
      setDniSocioServicio("");
      setMontoServicio("");
      setDescripcionServicio("");
      setNombreInstructor("");
    } catch (err: unknown) {
      toast.error("Error al registrar el servicio", {
        description: err instanceof Error ? err.message : "Verifique que el DNI pertenezca a un socio registrado o revise la conexión.",
      });
    } finally {
      setGuardandoServicio(false);
    }
  };

  //  GENERADOR DE PDF OFICIAL
  const generarPDF = (s: SolicitudAPI) => {
    const fecha = new Date().toLocaleDateString("es-PE", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const logoUrl = `${window.location.origin}/logo.png`;
    const motivo = s.observacion ?? "Sin observación registrada.";

    
    const html = [
      "<!DOCTYPE html>",
      "<html lang='es'>",
      "<head>",
      "  <meta charset='UTF-8' />",
      `  <title>Notificacion_Observacion_${s.tipo_doc_siglas || 'DNI'}_${s.dni}</title>`,
      "  <style>",
      "    @media print { @page { size: A4; margin: 0; } body { padding: 2cm !important; box-sizing: border-box; } }",
      "    body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.4; padding: 2cm; box-sizing: border-box; }",
      "    .header { text-align: center; border-bottom: 2px solid #1a3a5c; padding-bottom: 12px; margin-bottom: 20px; }",
      "    .header img { max-width: 120px; margin: 0 auto 10px; display: block; }",
      "    .header h2 { margin: 4px 0 0; font-size: 13pt; color: #1a3a5c; letter-spacing: 1px; }",
      "    .header p { margin: 2px 0; font-size: 10pt; color: #555; }",
      "    .fecha { text-align: right; font-size: 10pt; color: #555; margin-bottom: 20px; }",
      "    h1 { font-size: 12pt; text-align: center; text-transform: uppercase; letter-spacing: 1.5px; color: #1a3a5c; margin-bottom: 20px; }",
      "    .cuerpo { margin-bottom: 16px; }",
      "    .motivo { border: 1.5px solid #c0392b; border-radius: 6px; padding: 12px 16px; background: #fff5f5; margin: 16px 0; }",
      "    .motivo p { margin: 0; font-weight: bold; color: #c0392b; font-size: 10.5pt; text-align: justify; }",
      "    .cierre { margin-top: 20px; }",
      "    .firma-manuscrita { font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 26px; color: #1a365d; margin: 30px 0 8px 0; }",
      "    .firma-cargo { border-top: 1px solid #aaa; padding-top: 6px; width: 220px; font-size: 9pt; color: #555; }",
      "  </style>",
      "</head>",
      "<body>",
      "  <div class='header'>",
      `    <img src='${logoUrl}' alt='Logo Club Náutico Poseidón' />`,
      "    <h2>CLUB NÁUTICO POSEIDÓN DEL PERÚ</h2>",
      "    <p>Secretaría de Admisiones</p>",
      "  </div>",
      `  <div class='fecha'>Lima, ${fecha}</div>`,
      "  <h1>Notificación de Observación de Solicitud</h1>",
      "  <div class='cuerpo'>",
      `    <p>Estimado(a) <strong>${s.nombres} ${s.apellidos}</strong>,</p>`,
      "    <p>",
      "      Le informamos que su solicitud de inscripción al Club Náutico Poseidón del Perú,",
      `      presentada con ${s.tipo_doc_siglas || 'DNI'} <strong>${s.dni}</strong>, ha sido evaluada por la Jefatura de`,
      "      Atención al Cliente. Lamentablemente, la solicitud no ha podido ser aprobada en",
      "      esta instancia por el siguiente motivo:",
      "    </p>",
      "  </div>",
      "  <div class='motivo'>",
      `    <p>${motivo}</p>`,   
      "  </div>",              
      "  <div class='cierre'>",
      "    <p>",
      "      Le invitamos a subsanar el motivo indicado y presentar nuevamente su solicitud",
      "      para continuar con su proceso de inscripción. Nuestro equipo de Secretaría",
      "      estará disponible para orientarle en los pasos a seguir.",
      "    </p>",
      "    <p>Atentamente,</p>",
      "  </div>",
      "  <div class='firma-manuscrita'>La Jefatura</div>",
      "  <div class='firma-cargo'>",
      "    Secretaría de Admisiones<br/>",
      "    Club Náutico Poseidón del Perú",
      "  </div>",
      "</body>",
      "</html>"
    ].join("\n");

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 2000);
    };
  };

  return (
    <div className="space-y-6 p-1">
      {/* Cabecera Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Panel de Secretaría
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestione flujos de admisión y cargos recurrentes de socios activos.</p>
        </div>

        <div className="flex items-center gap-3">
          <ModalNuevaSolicitud
            onSuccess={() => { fetchMetricas(); fetchSolicitudes(); }}
            triggerSize="default"
            triggerClassName="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2.5 rounded-xl shadow-sm transition-transform active:scale-95"
          />
          <Button
            variant="outline"
            className="gap-2 font-medium px-4 py-2.5 rounded-xl shadow-sm transition-transform active:scale-95"
            onClick={() => setDisponibilidadDialog(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Disponibilidad de Servicios
          </Button>
          <Button 
            className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-600 hover:to-amber-700 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-transform active:scale-95 border-0"
            onClick={() => setServicioDialog(true)}
          >
            <CreditCard className="h-4 w-4" />
            Registrar Consumo
          </Button>
        </div>
      </div>

      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Solicitudes en Espera</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{metricas.solicitudesEnEspera}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <ClipboardList className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Socios Activos</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{metricas.sociosActivos}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <Users className="h-6 w-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alertas</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{metricas.alertas}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buscador Dinámico */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            type="text" 
            placeholder="Buscar por nombre o DNI..." 
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtro:</span>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {["Todos", "Pendiente", "Aprobado", "Rechazado"].map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  filtroEstado === estado
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {estado}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla Unificada */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Solicitudes en curso
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Mostrar</span>
            <Select
              value={String(registrosPorPagina)}
              onValueChange={(val) => setRegistrosPorPagina(Number(val))}
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
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/20 dark:bg-slate-950/20">
              <TableRow className="border-b border-slate-200 dark:border-slate-800">
                <TableHead className="font-bold text-xs pl-6 py-3">Documento</TableHead>
                <TableHead className="font-bold text-xs">Nombre Completo</TableHead>
                <TableHead className="font-bold text-xs">Clasificación</TableHead>
                <TableHead className="font-bold text-xs">Estado</TableHead>
                <TableHead className="font-bold text-xs">Fecha</TableHead>
                <TableHead className="font-bold text-xs text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargandoLista ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 dark:text-slate-500 py-10 text-sm">
                    Cargando solicitudes desde el servidor náutico...
                  </TableCell>
                </TableRow>
              ) : errorLista ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-rose-500 font-medium py-10 text-sm">
                    {errorLista}
                  </TableCell>
                </TableRow>
              ) : solicitudesPaginadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-10 text-sm">
                    No se encontraron coincidencias en la bandeja.
                  </TableCell>
                </TableRow>
              ) : (
                solicitudesPaginadas.map((s) => (
                  <TableRow key={s.id_solicitud} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                    <TableCell className="font-mono text-xs pl-6 py-4">
                      <span className="text-slate-400 mr-1.5 font-bold">{s.tipo_doc_siglas || "DNI"}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{s.dni}</span>
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-slate-900 dark:text-slate-100">{s.nombres} {s.apellidos}</TableCell>
                    <TableCell>
                      {s.clasificacion === "Pagador" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none font-medium rounded-md">Pagador</Badge>
                      ) : s.clasificacion === "Renuente" ? (
                        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-none font-medium rounded-md">Renuente</Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-none font-medium rounded-md">{s.clasificacion || "Esporádico"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.estado === "Pendiente" ? (
                        <Badge className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded-md animate-pulse">Pendiente</Badge>
                      ) : s.estado === "Rechazado" ? (
                        <Badge className="bg-rose-600 text-white font-bold px-2 py-0.5 rounded-md">Rechazado</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md">Aprobado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString("es-PE") : "—"}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Botones solo visibles para Rechazados */}
                        {s.estado === "Rechazado" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg"
                              title="Ver Observaciones"
                              onClick={() => { setMotivoSeleccionado(s.observacion || "Sin novedades adicionales en bandeja."); setMotivoDialog(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                              title="Imprimir Notificación"
                              onClick={() => generarPDF(s)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ── Barra de paginación ────────────────────────────────────── */}
          {!cargandoLista && !errorLista && totalRegistros > 0 && (
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



      {/* Modal Registrar Servicio (Integrado a API) */}
      <Dialog open={servicioDialog} onOpenChange={setServicioDialog}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Registrar Servicio a Socio
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Registre servicios adicionales o cargos recurrentes a socios activos. El cargo quedará marcado como <strong>Pendiente de Facturación</strong> hasta el cierre de mes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegistrarServicioSubmit} className="space-y-4 py-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documento del Titular</label>
              <div className="flex gap-2">
                <select
                  className="flex h-10 w-24 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 text-sm text-slate-800 dark:text-slate-200"
                  value={tipoDocServicio}
                  onChange={(e) => handleChangeTipoDocServicio(e.target.value)}
                >
                  <option value="DNI">DNI</option>
                  <option value="CE">CE</option>
                  <option value="PAS">PAS</option>
                </select>
                <Input
                  type="text"
                  placeholder={
                    tipoDocServicio === "DNI" ? "Ej. 60988743" :
                    tipoDocServicio === "PAS" ? "Ej. AB1234567890" :
                    "Ej. 000123456"
                  }
                  maxLength={LIMITE_DOC_SERVICIO[tipoDocServicio]}
                  value={dniSocioServicio}
                  onChange={(e) => handleChangeDniServicio(e.target.value)}
                  onBlur={() => buscarSocioPorDocumento(tipoDocServicio, dniSocioServicio)}
                  required
                  className="rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>
              {buscandoSocio && (
                <p className="text-xs text-slate-400">Buscando socio...</p>
              )}
              {socioEncontrado && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✓ {socioEncontrado.nombres} {socioEncontrado.apellidos} · {socioEncontrado.clasificacion}
                </p>
              )}
              {errorBusquedaSocio && (
                <p className="text-xs text-rose-500">{errorBusquedaSocio}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Servicio</label>
              <select
                className="w-full flex h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                value={categoriaServicio}
                onChange={(e) => setCategoriaServicio(e.target.value)}
              >
                {GRUPOS_SERVICIOS.map((grupo) => (
                  <optgroup key={grupo.grupo} label={grupo.grupo}>
                    {grupo.items.map((item) => {
                      const disponible = esServicioDisponible(item.valor);
                      return (
                        <option key={item.valor} value={item.valor} disabled={!disponible}>
                          {item.label}{!disponible ? " (No disponible)" : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
                <optgroup label="Servicios Adicionales">
                  <option value="Otros">Otros (especificar en descripción)</option>
                </optgroup>
              </select>
            </div>
            {esServicioInstructor && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Instructor</label>
                <Input
                  type="text"
                  placeholder="Ej. Carlos Mendoza"
                  value={nombreInstructor}
                  onChange={(e) => setNombreInstructor(e.target.value)}
                  required
                  className="rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Monto (S/.) {categoriaServicio !== "Otros" && preciosServicios[categoriaServicio] !== undefined && (
                  <span className="text-slate-300 font-normal">· Tarifa preestablecida</span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder={cargandoPrecios ? "Cargando tarifa..." : "0.00"}
                value={montoServicio}
                onChange={(e) => setMontoServicio(e.target.value)}
                required
                readOnly={categoriaServicio !== "Otros" && preciosServicios[categoriaServicio] !== undefined}
                className={`rounded-lg border-slate-200 dark:border-slate-800 ${
                  categoriaServicio !== "Otros" && preciosServicios[categoriaServicio] !== undefined
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-950"
                }`}
              />
              {categoriaServicio !== "Otros" && preciosServicios[categoriaServicio] === undefined && !cargandoPrecios && (
                <p className="text-xs text-amber-500">No se encontró tarifa preestablecida; ingrese el monto manualmente.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider"> Descripción (Opcional)</label>
              <Input type="text" placeholder="Detalle interno..." value={descripcionServicio} onChange={(e) => setDescripcionServicio(e.target.value)} className="rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"/>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setServicioDialog(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg" disabled={guardandoServicio}>
                {guardandoServicio ? "Registrando..." : "Registrar Servicio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Observaciones */}
      <Dialog open={motivoDialog} onOpenChange={setMotivoDialog}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Observación de Solicitud</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
            {motivoSeleccionado}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Gestionar Disponibilidad de Servicios (nuevo) */}
      <Dialog open={disponibilidadDialog} onOpenChange={setDisponibilidadDialog}>
        <DialogContent className="sm:max-w-2xl rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              Disponibilidad de Servicios
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Marca un servicio como no disponible (ej. salón en mantenimiento, ya reservado) para que no pueda seleccionarse
              al registrar un consumo. Puedes agregar un motivo opcional para dejar constancia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {cargandoDisponibilidad ? (
              <p className="text-sm text-slate-400 text-center py-6">Cargando disponibilidad de servicios...</p>
            ) : (
              GRUPOS_SERVICIOS.map((grupo) => (
                <div key={grupo.grupo} className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{grupo.grupo}</p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {grupo.items.map((item) => {
                      const disponible = esServicioDisponible(item.valor);
                      const guardando = guardandoServicioKey === item.valor;
                      return (
                        <div key={item.valor} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                            <Badge
                              className={`mt-1 text-xs ${
                                disponible
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-rose-100 text-rose-700 border-rose-200"
                              }`}
                            >
                              {disponible ? "Disponible" : "No disponible"}
                            </Badge>
                          </div>
                          <Input
                            placeholder="Motivo (opcional)"
                            defaultValue={disponibilidadServicios[item.valor]?.motivo ?? ""}
                            onChange={(e) =>
                              setMotivoInputs((prev) => ({ ...prev, [item.valor]: e.target.value }))
                            }
                            className="h-9 text-xs sm:w-56"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant={disponible ? "outline" : "default"}
                            className={!disponible ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-rose-600 hover:text-rose-700"}
                            disabled={guardando}
                            onClick={() => handleToggleDisponibilidad(item.valor)}
                          >
                            {guardando ? "Guardando..." : disponible ? "Deshabilitar" : "Habilitar"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setDisponibilidadDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
