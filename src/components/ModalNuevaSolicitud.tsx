import { useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiClient"; 
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";


// Props

interface ModalNuevaSolicitudProps {
  /** Se llama cuando el POST fue exitoso, para que el padre recargue su tabla */
  onSuccess?: () => void;
  /** Variante del botón disparador (por defecto "default") */
  triggerVariant?: "default" | "outline" | "ghost";
  /** Tamaño del botón disparador (por defecto "default") */
  triggerSize?: "default" | "sm" | "lg" | "icon";
  /** Clases extra para el botón disparador */
  triggerClassName?: string;
}

// ---------------------------------------------------------------------------
// Formulario vacío
// ---------------------------------------------------------------------------
const formVacio = {
  dni:           "",
  nombres:       "",
  apellidos:     "",
  clasificacion: "",
  telefono:      "",
  correo:        "",
};

// Solo letras (con tildes y ñ) y espacios; nada de números ni símbolos.
const REGEX_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

// ── Configuración de validación por tipo de documento ─────────────────────
// idTipoDoc → 1: DNI, 2: CE, 3: PAS
const LIMITE_DOC: Record<number, number> = { 1: 8, 2: 9, 3: 12 };
const REGEX_DOC: Record<number, RegExp> = {
  1: /^[0-9]*$/,        // DNI: solo números
  2: /^[0-9]*$/,        // CE: solo números (sin letras ni símbolos/espacios)
  3: /^[a-zA-Z0-9]*$/,  // PAS: letras y números (sin símbolos/espacios)
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
export default function ModalNuevaSolicitud({
  onSuccess,
  triggerVariant   = "default",
  triggerSize      = "default",
  triggerClassName = "gap-2",
}: ModalNuevaSolicitudProps) {
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState(formVacio);
  const [idTipoDoc, setIdTipoDoc] = useState(1);
  const [cargando, setCargando]   = useState(false);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const { toast } = useToast();

  const handleChange = (campo: keyof typeof formVacio, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setForm(formVacio);
      setIdTipoDoc(1);
      setErrorMsg(null);
    }
  };

  // ── Validación dinámica por tipo de documento ─────────────────────────────
  const validarDocumento = (numero: string, tipo: number): string | null => {
    const limpio = numero.trim();
    if (!limpio) return "El número de documento no puede estar vacío.";
    if (tipo === 1) {
      if (!/^\d{8}$/.test(limpio)) return "El DNI debe tener exactamente 8 dígitos numéricos.";
    } else if (tipo === 2) {
      if (!/^\d{1,9}$/.test(limpio)) return "El Carné de Extranjería debe contener solo números (máximo 9 dígitos).";
    } else if (tipo === 3) {
      if (!/^[a-zA-Z0-9]{1,12}$/.test(limpio)) return "El Pasaporte debe ser alfanumérico (máximo 12 caracteres).";
    }
    return null;
  };

  // Filtra caracteres no permitidos mientras se escribe, según el tipo de doc actual
  const handleChangeDocumento = (valor: string) => {
    const mayus = valor.toUpperCase();
    const regex = REGEX_DOC[idTipoDoc] ?? /^[a-zA-Z0-9]*$/;
    const limite = LIMITE_DOC[idTipoDoc] ?? 12;
    if ((mayus === "" || regex.test(mayus)) && mayus.length <= limite) {
      handleChange("dni", mayus);
    }
  };

  // Al cambiar el tipo de documento, limpia/recorta el valor actual si ya
  // no es compatible con el nuevo tipo (ej. pasar de CE con letras a DNI)
  const handleChangeTipoDoc = (val: string) => {
    const nuevoTipo = Number(val);
    setIdTipoDoc(nuevoTipo);
    setForm((prev) => {
      const limite = LIMITE_DOC[nuevoTipo] ?? 12;
      let valorLimpio = (nuevoTipo === 1 || nuevoTipo === 2)
        ? prev.dni.replace(/\D/g, "")             // DNI/CE: descarta todo lo que no sea número
        : prev.dni.replace(/[^a-zA-Z0-9]/g, "");   // PAS: descarta símbolos/espacios
      valorLimpio = valorLimpio.slice(0, limite);
      return { ...prev, dni: valorLimpio };
    });
  };

  // ── Validación de Nombres y Apellidos ─────────────────────────────────────
  const validarNombreOApellido = (valor: string, etiqueta: string): string | null => {
    const limpio = valor.trim();
    if (!limpio) return `${etiqueta} no puede estar vacío.`;
    if (limpio.length < 2) return `${etiqueta} debe tener al menos 2 caracteres.`;
    if (limpio.length > 50) return `${etiqueta} no puede superar los 50 caracteres.`;
    if (!REGEX_NOMBRE.test(limpio)) return `${etiqueta} solo puede contener letras y espacios, sin números ni símbolos.`;

    const palabras = limpio.split(/\s+/);
    const todasConMayuscula = palabras.every((palabra) => /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]*$/.test(palabra));
    if (!todasConMayuscula) {
      return `${etiqueta}: cada palabra debe iniciar con mayúscula (ej. "Juan Carlos").`;
    }
    return null;
  };

  // Mientras el usuario escribe: solo bloquea números y símbolos
  const handleChangeSoloLetras = (campo: "nombres" | "apellidos", valor: string) => {
    const filtrado = valor.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]/g, "");
    setForm((prev) => ({ ...prev, [campo]: filtrado }));
  };

  // Al salir del campo capitaliza automáticamente cada palabra
  const capitalizarPalabras = (campo: "nombres" | "apellidos") => {
    setForm((prev) => {
      const valor = prev[campo].trim();
      if (!valor) return prev;
      const capitalizado = valor
        .toLowerCase()
        .split(/\s+/)
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" ");
      return { ...prev, [campo]: capitalizado };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validar nombres
    const errorNombres = validarNombreOApellido(form.nombres, "Nombres");
    if (errorNombres) { setErrorMsg(errorNombres); return; }

    // 2. Validar apellidos
    const errorApellidos = validarNombreOApellido(form.apellidos, "Apellidos");
    if (errorApellidos) { setErrorMsg(errorApellidos); return; }

    // 3. Validar documento
    const errorDoc = validarDocumento(form.dni, idTipoDoc);
    if (errorDoc) { setErrorMsg(errorDoc); return; }

    setCargando(true);
    setErrorMsg(null);

    try {
      const res = await apiFetch("/api/solicitudes/crear", {
        method: "POST",
        body: JSON.stringify({
          id_tipo_doc:   idTipoDoc,
          dni:           form.dni.trim().toUpperCase(),
          nombres:       form.nombres.trim(),
          apellidos:     form.apellidos.trim(),
          clasificacion: form.clasificacion,
          telefono:      form.telefono,
          correo:        form.correo,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setForm(formVacio);
        setOpen(false);
        toast({
          title: "Solicitud enviada",
          description: "La solicitud de inscripción ha sido registrada correctamente.",
        });
        onSuccess?.();
      } else if (res.status === 400) {
        setErrorMsg(data.mensaje ?? "El documento ya se encuentra registrado.");
      } else {
        setErrorMsg(data.mensaje ?? `Error ${res.status}: no se pudo registrar la solicitud.`);
      }
    } catch {
      setErrorMsg("Error de red. Verifica tu conexión e intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          <Plus className="h-4 w-4" /> Nueva Solicitud
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Socio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nombres y Apellidos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sol-nombres">Nombres</Label>
              <Input
                id="sol-nombres"
                placeholder="Ej. Juan Carlos"
                value={form.nombres}
                onChange={(e) => handleChangeSoloLetras("nombres", e.target.value)}
                onBlur={() => capitalizarPalabras("nombres")}
                required
                autoComplete="given-name"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-apellidos">Apellidos</Label>
              <Input
                id="sol-apellidos"
                placeholder="Ej. Pérez García"
                value={form.apellidos}
                onChange={(e) => handleChangeSoloLetras("apellidos", e.target.value)}
                onBlur={() => capitalizarPalabras("apellidos")}
                required
                autoComplete="family-name"
                maxLength={50}
              />
            </div>
          </div>

          {/* Tipo de Documento + Número de Documento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sol-tipo-doc">Tipo de Documento</Label>
              <Select
                value={String(idTipoDoc)}
                onValueChange={handleChangeTipoDoc}
              >
                <SelectTrigger id="sol-tipo-doc">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">DNI (Documento Nacional de Identidad)</SelectItem>
                  <SelectItem value="2">CE (Carné de Extranjería)</SelectItem>
                  <SelectItem value="3">PAS (Pasaporte)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-dni">Número de Documento</Label>
              <Input
                id="sol-dni"
                placeholder={
                  idTipoDoc === 1 ? "Ej. 12345678" :
                  idTipoDoc === 2 ? "Ej. 000123456" :
                  "Ej. AB1234567890"
                }
                value={form.dni}
                onChange={(e) => handleChangeDocumento(e.target.value)}
                maxLength={LIMITE_DOC[idTipoDoc]}
                required
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Teléfono y Correo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sol-telefono">Teléfono</Label>
              <Input
                id="sol-telefono"
                placeholder="987654321"
                value={form.telefono}
                onChange={(e) => handleChange("telefono", e.target.value.replace(/\D/g, ""))}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-correo">Correo electrónico</Label>
              <Input
                id="sol-correo"
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.correo}
                onChange={(e) => handleChange("correo", e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Clasificación de Antecedentes */}
          <div className="space-y-1.5">
            <Label htmlFor="sol-clasificacion">Clasificación de Antecedentes</Label>
            <Select
              value={form.clasificacion}
              onValueChange={(val) => handleChange("clasificacion", val)}
            >
              <SelectTrigger id="sol-clasificacion">
                <SelectValue placeholder="Seleccionar clasificación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pagador">Pagador</SelectItem>
                <SelectItem value="Esporádico">Esporádico</SelectItem>
                <SelectItem value="Renuente">Renuente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive font-medium" role="alert">{errorMsg}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={cargando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={cargando || !form.clasificacion}>
              {cargando ? "Enviando" : "Enviar Solicitud"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
