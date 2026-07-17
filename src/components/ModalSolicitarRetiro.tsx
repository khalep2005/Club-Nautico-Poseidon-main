import { useState } from "react";
import { UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";

interface ModalSolicitarRetiroProps {
  idSocio: number;
  nombreSocio: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export default function ModalSolicitarRetiro({
  idSocio,
  nombreSocio,
  onSuccess,
  trigger,
}: ModalSolicitarRetiroProps) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      toast.error("El motivo es obligatorio");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/retiros/solicitar", {
        method: "POST",
        body: JSON.stringify({
          id_socio: idSocio,
          motivo: motivo.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al registrar la solicitud de retiro");
      }

      toast.success("Solicitud registrada con éxito", {
        description: `Se ha registrado la solicitud de retiro para ${nombreSocio}.`,
      });

      setMotivo("");
      setOpen(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error("Error al registrar la solicitud", {
        description: error.message || "Ocurrió un problema de conexión con el servidor.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 text-xs h-8 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
            <UserMinus className="h-3.5 w-3.5" />
            Solicitar Retiro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <UserMinus className="h-5 w-5 text-rose-500" />
            Registrar Solicitud de Retiro
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Se iniciará el proceso de baja voluntaria para el socio{" "}
            <strong className="text-slate-900 dark:text-white">{nombreSocio}</strong>.
            Esta solicitud quedará en estado pendiente hasta ser aprobada por el Jefe de Atención al Cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <label
              htmlFor="motivo-retiro"
              className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Motivo del Retiro <span className="text-rose-500">*</span>
            </label>
            <Textarea
              id="motivo-retiro"
              placeholder="Escriba detalladamente el motivo por el cual el socio solicita su retiro..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[120px] rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus-visible:ring-rose-500 text-sm"
              required
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !motivo.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar Solicitud"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
