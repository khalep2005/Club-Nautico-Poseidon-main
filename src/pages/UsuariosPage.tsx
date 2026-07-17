import { useState, useEffect } from "react";
import { UserCog, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/apiClient"; 
// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

// Shape real que devuelve GET /api/admin/usuarios (auth-service, entidad Usuario):
// { id, correo, nombres, apellidos, rol } -- "rol" viene como STRING ("1", "2"...),
// y el campo se llama "id" y "rol", no "id_usuario"/"id_rol" como se asumía antes.
interface UsuarioAPI {
  id:        number;
  nombres:   string;
  apellidos: string;
  correo:    string;
  rol:       string;
}

type Rol = "Secretaria" | "Naviero" | "Finanzas" | "Jefe" | "Cobranza";

// Shape interno para la tabla
interface Usuario {
  id:         number;
  id_usuario: number;   // conservamos el id original del backend para DELETE/PUT
  nombres:    string;
  apellidos:  string;
  nombre:     string;   // nombres + apellidos (display)
  correo:     string;
  rol:        Rol;
  id_rol:     number;
}

// ---------------------------------------------------------------------------
// Datos de rol
// ---------------------------------------------------------------------------
const rolColors: Record<Rol, string> = {
  Jefe:       "bg-primary/10 text-primary border-primary/20",
  Secretaria: "bg-secondary/10 text-secondary border-secondary/20",
  Naviero:    "bg-accent text-accent-foreground border-accent",
  Finanzas:   "bg-success/10 text-success border-success/20",
  Cobranza:   "bg-destructive/10 text-destructive border-destructive/20",
};

// id_rol numérico → nombre visual
const rolPorId: Record<number, Rol> = {
  1: "Jefe",
  2: "Secretaria",
  3: "Naviero",
  4: "Finanzas",
  5: "Cobranza",
};

// Nombre de rol → id_rol numérico (para el POST)
const rolIdMap: Record<Rol, number> = {
  Jefe:       1,
  Secretaria: 2,
  Naviero:    3,
  Finanzas:   4,
  Cobranza:   5,
};

// ---------------------------------------------------------------------------
// Formulario vacío — registro
// ---------------------------------------------------------------------------
const formVacio = {
  nombres:    "",
  apellidos:  "",
  correo:     "",
  contrasena: "",
  rol:        "" as Rol | "",
};

// Formulario vacío — edición
const editFormVacio = {
  nombres:   "",
  apellidos: "",
  rol:       "" as Rol | "",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function UsuariosPage() {
  const [usuarios, setUsuarios]           = useState<Usuario[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista]       = useState<string | null>(null);

  // ── Modal registro ────────────────────────────────────────────────────────
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [form, setForm]                   = useState(formVacio);
  const [cargando, setCargando]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Modal edición ─────────────────────────────────────────────────────────
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<Usuario | null>(null);
  const [editForm, setEditForm]                 = useState(editFormVacio);
  const [cargandoEdit, setCargandoEdit]         = useState(false);
  const [errorEdit, setErrorEdit]               = useState<string | null>(null);

  // ── Confirmación de eliminación ───────────────────────────────────────────
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);

  // ── Cargar usuarios desde el backend ─────────────────────────────────────
  const fetchUsuarios = async () => {
    setCargandoLista(true);
    setErrorLista(null);
    try {
      const res = await apiFetch("/api/admin/usuarios");
      if (!res.ok) throw new Error(`Error ${res.status}: no se pudo cargar la lista.`);
      const data: UsuarioAPI[] = await res.json();
      const mapeados: Usuario[] = data.map((u) => ({
        id:         u.id,
        id_usuario: u.id,
        nombres:    u.nombres,
        apellidos:  u.apellidos,
        nombre:     `${u.nombres} ${u.apellidos}`,
        correo:     u.correo,
        rol:        rolPorId[Number(u.rol)] ?? "Naviero",
        id_rol:     Number(u.rol),
      }));
      setUsuarios(mapeados);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  // ── Abrir / cerrar modal ──────────────────────────────────────────────────
  const abrirDialog = () => {
    setForm(formVacio);
    setError(null);
    setDialogAbierto(true);
  };

  // ── Manejo del formulario ─────────────────────────────────────────────────
  const handleChange = (campo: keyof typeof formVacio, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  /**
   * handleSubmit
   * Apunta a POST /auth/register (RegisterRequest.java del auth-service espera
   * { correo, password, nombres, apellidos, rol } donde "rol" es el ID como STRING,
   * ej. "1", no un número). La respuesta es { accessToken, refreshToken, tokenType } --
   * NO devuelve el usuario creado, por eso abajo se sigue usando el fallback Date.now().
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rol) { setError("Selecciona un rol."); return; }

    setCargando(true);
    setError(null);

    try {
      const res = await apiFetch("/auth/register", {
  method: "POST",
  body: JSON.stringify({
    nombres:   form.nombres,
    apellidos: form.apellidos,
    correo:    form.correo,
    password:  form.contrasena,
    rol:       String(rolIdMap[form.rol as Rol]),
  }),
});

      const data = await res.json();

      // El backend responde 200 OK (no 201) y sin id_usuario -- ver comentario arriba.
      if (res.ok) {
        // Éxito: agregar a la tabla local y cerrar modal
        const nuevoUsuario: Usuario = {
          id:         data.id_usuario ?? Date.now(),
          id_usuario: data.id_usuario ?? Date.now(),
          nombres:    form.nombres,
          apellidos:  form.apellidos,
          nombre:     `${form.nombres} ${form.apellidos}`,
          correo:     form.correo,
          rol:        form.rol as Rol,
          id_rol:     Number(rolIdMap[form.rol as Rol]),
        };
        setUsuarios((prev) => [...prev, nuevoUsuario]);
        setForm(formVacio);
        setDialogAbierto(false);
        // Refrescamos contra el backend para reemplazar el id local (Date.now())
        // por el id_usuario real una vez que el usuario aparezca en la lista.
        await fetchUsuarios();
      } else {
        setError(data.message ?? data.mensaje ?? "Error al registrar el usuario.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  };

  // ── Eliminar usuario ──────────────────────────────────────────────────────
  const confirmarEliminar = async () => {
    if (!usuarioAEliminar) return;

    try {
      const res = await apiFetch(`/api/admin/usuarios/${usuarioAEliminar.id_usuario}`, {
  method: "DELETE",
});
      if (res.ok) {
        setUsuarios((prev) => prev.filter((u) => u.id_usuario !== usuarioAEliminar.id_usuario));
        setUsuarioAEliminar(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.mensaje ?? `Error ${res.status}: no se pudo eliminar el usuario.`);
      }
    } catch {
      alert("Error de red al intentar eliminar el usuario.");
    }
  };

  // ── Abrir modal de edición ────────────────────────────────────────────────
  const abrirEdicion = (usuario: Usuario) => {
    setUsuarioEnEdicion(usuario);
    setEditForm({
      nombres:   usuario.nombres,
      apellidos: usuario.apellidos,
      rol:       usuario.rol,
    });
    setErrorEdit(null);
  };

  const handleEditChange = (campo: keyof typeof editFormVacio, valor: string) => {
    setEditForm((prev) => ({ ...prev, [campo]: valor }));
  };

  // ── Enviar edición ────────────────────────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEnEdicion || !editForm.rol) { setErrorEdit("Selecciona un rol."); return; }

    setCargandoEdit(true);
    setErrorEdit(null);

    try {
      const res = await apiFetch(`/api/admin/usuarios/${usuarioEnEdicion.id_usuario}`, {
  method: "PUT",
  body: JSON.stringify({
    nombres: editForm.nombres,
    apellidos: editForm.apellidos,
    id_rol: Number(rolIdMap[editForm.rol as Rol]),
  }),
});

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setUsuarioEnEdicion(null);
        await fetchUsuarios();
      } else {
        setErrorEdit(data.mensaje ?? `Error ${res.status}: no se pudo actualizar el usuario.`);
      }
    } catch {
      setErrorEdit("Error de red al intentar actualizar el usuario.");
    } finally {
      setCargandoEdit(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Mantenimiento de Usuarios</h1>
          </div>
        </div>

        <Button onClick={abrirDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Usuario
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Nombre</TableHead>
              <TableHead className="font-semibold">Correo</TableHead>
              <TableHead className="font-semibold">Rol</TableHead>
              <TableHead className="font-semibold text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargandoLista ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  Cargando usuarios
                </TableCell>
              </TableRow>
            ) : errorLista ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-destructive py-10">
                  {errorLista}
                </TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{u.correo}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${rolColors[u.rol]}`}
                    >
                      {u.rol}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${u.nombre}`}
                        onClick={() => abrirEdicion(u)}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${u.nombre}`}
                        onClick={() => setUsuarioAEliminar(u)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de registro */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Registrar nuevo usuario
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Nombres */}
            <div className="space-y-1.5">
              <Label htmlFor="nombres">Nombres</Label>
              <Input
                id="nombres"
                type="text"
                placeholder="Ej. Juan Carlos"
                value={form.nombres}
                onChange={(e) => handleChange("nombres", e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>

            {/* Apellidos */}
            <div className="space-y-1.5">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                type="text"
                placeholder="Ej. Pérez García"
                value={form.apellidos}
                onChange={(e) => handleChange("apellidos", e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>

            {/* Correo */}
            <div className="space-y-1.5">
              <Label htmlFor="correo">Correo electrónico</Label>
              <Input
                id="correo"
                type="email"
                placeholder="usuario@poseidon.pe"
                value={form.correo}
                onChange={(e) => handleChange("correo", e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label htmlFor="contrasena">Contraseña</Label>
              <Input
                id="contrasena"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={form.contrasena}
                onChange={(e) => handleChange("contrasena", e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label htmlFor="rol">Asignar rol</Label>
              <Select
                value={form.rol}
                onValueChange={(val) => handleChange("rol", val)}
              >
                <SelectTrigger id="rol">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jefe">Jefe </SelectItem>
                  <SelectItem value="Secretaria">Secretaría </SelectItem>
                  <SelectItem value="Naviero">Naviero </SelectItem>
                  <SelectItem value="Finanzas">Finanzas </SelectItem>
                  <SelectItem value="Cobranza">Cobranza </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogAbierto(false)}
                disabled={cargando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={cargando}>
                {cargando ? "Registrando" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Modal de edición */}
      <Dialog open={!!usuarioEnEdicion} onOpenChange={(open) => { if (!open) setUsuarioEnEdicion(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar usuario
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {/* Nombres */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-nombres">Nombres</Label>
              <Input
                id="edit-nombres"
                type="text"
                placeholder="Ej. Juan Carlos"
                value={editForm.nombres}
                onChange={(e) => handleEditChange("nombres", e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>

            {/* Apellidos */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-apellidos">Apellidos</Label>
              <Input
                id="edit-apellidos"
                type="text"
                placeholder="Ej. Pérez García"
                value={editForm.apellidos}
                onChange={(e) => handleEditChange("apellidos", e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-rol">Rol</Label>
              <Select
                value={editForm.rol}
                onValueChange={(val) => handleEditChange("rol", val)}
              >
                <SelectTrigger id="edit-rol">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jefe">Jefe </SelectItem>
                  <SelectItem value="Secretaria">Secretaría </SelectItem>
                  <SelectItem value="Naviero">Naviero </SelectItem>
                  <SelectItem value="Finanzas">Finanzas </SelectItem>
                  <SelectItem value="Cobranza">Cobranza </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {errorEdit && (
              <p className="text-sm text-destructive" role="alert">{errorEdit}</p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUsuarioEnEdicion(null)}
                disabled={cargandoEdit}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={cargandoEdit}>
                {cargandoEdit ? "Guardando" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* AlertDialog de confirmación de eliminación */}
      <AlertDialog
        open={!!usuarioAEliminar}
        onOpenChange={(open) => !open && setUsuarioAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar a este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta de{" "}
              <span className="font-medium text-foreground">
                {usuarioAEliminar?.nombres} {usuarioAEliminar?.apellidos}
              </span>{" "}
              y sus datos serán removidos de los servidores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmarEliminar}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
