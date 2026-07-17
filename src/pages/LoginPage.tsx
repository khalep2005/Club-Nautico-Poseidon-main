import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"; 
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";

const API_URL = `${import.meta.env.VITE_API_URL}/auth/login`;

// El backend no devuelve un objeto "usuario" en el login: el rol viaja
// embebido dentro del propio accessToken (claim "role_id"). Lo decodificamos
// manualmente (sin librería extra) leyendo el payload del JWT.
function decodeJwtPayload(token: string): { role_id?: number; sub?: string } {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export default function LoginPage() {
  const { setCurrentRole } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: email,
          password: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const payload = decodeJwtPayload(data.accessToken);

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("id_rol", String(payload.role_id ?? ""));

        const rolesMap: Record<number, "Jefe" | "Secretaria" | "Naviero" | "Finanzas" | "Cobranza"> = {
          1: "Jefe",
          2: "Secretaria",
          3: "Naviero",
          4: "Finanzas",
          5: "Cobranza"
        };

        const roleName = payload.role_id ? rolesMap[payload.role_id] : undefined;

        if (roleName) {
          setCurrentRole(roleName);
        }
        toast({
          title: "¡Bienvenido a bordo!",
          description: `Has ingresado como ${payload.sub ?? email}`,
        });

        navigate("/dashboard");
      } else {
        toast({
          title: "Error de acceso",
          description: data.message || data.mensaje || "Credenciales incorrectas.",
          variant: "destructive",
        });
        setPassword("");
      }
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor de Poseidón.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-[#f7f9fb] font-['Inter',system-ui,sans-serif] text-[#191c1e] min-h-screen flex flex-col relative md:overflow-hidden">
      
      {/* Botón Volver al Inicio en la esquina superior izquierda */}
      <button 
        type="button"
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:text-white rounded-full backdrop-blur-md transition-all duration-300 group shadow-lg shadow-black/10"
      >
        <ArrowLeft className="h-3.5 w-3.5 transform group-hover:-translate-x-1 transition-transform duration-300 text-[#ffe088] group-hover:text-white" />
        <span>Volver al Inicio</span>
      </button>

      <main className="flex-grow flex flex-col md:flex-row md:h-screen overflow-hidden">
        
        {/* Left Section: Visual Narrative (Mobile Header / Desktop Side) */}
        <div className="relative w-full md:w-7/12 lg:w-3/5 min-h-[30vh] md:h-full overflow-hidden">
          {/* Background Video */}
          <div className="absolute inset-0 z-0">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-full object-cover scale-105"
            >
              <source src="/veleros.mp4" type="video/mp4" />
            </video>
          </div>
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#031636]/85 to-[#031636]/95 z-10" />
          
          {/* Hero Content */}
          <div className="absolute inset-0 z-20 flex flex-col justify-end md:justify-center px-8 py-12 md:px-16 lg:px-24">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h1 className="text-white text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight font-['Fraunces',Georgia,serif]">
                  Gestión<br />
                  <span className="text-[#ffe088] tracking-[0.2em] uppercase text-lg md:text-xl lg:text-2xl block mt-3 font-bold font-['Fraunces',Georgia,serif]">
                    Náutica
                  </span>
                </h1>
                <p className="text-[#b6c6f0] text-sm md:text-base lg:text-lg leading-relaxed max-w-lg hidden md:block">
                  Administra embarcaciones, servicios y membresías con seguridad y precisión.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Right Section: Login Form */}
        <div className="w-full md:w-5/12 lg:w-2/5 bg-[#f7f9fb] flex flex-col items-center justify-center px-6 py-6 md:py-8 lg:py-12 relative z-20 -mt-8 md:mt-0 rounded-t-xl md:rounded-none shadow-md min-h-[70vh] md:min-h-0 md:h-full md:overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-[380px] my-auto"
          >
            {/* Logo Cluster above the Card */}
            <div className="flex flex-col items-center mb-4 lg:mb-6">
              <div className="mb-2">
                <img 
                  className="w-20 h-20 lg:w-24 lg:h-24 object-contain animate-fade-in" 
                  src="/logo.png" 
                  alt="Logo Club Náutico Poseidón" 
                />
              </div>
              <div className="text-center font-['Fraunces',Georgia,serif]">
                <h2 className="text-lg lg:text-xl text-[#031636] font-extrabold">
                  Club Náutico Poseidón
                </h2>
                <p className="text-[9px] md:text-[10px] text-[#44474e] tracking-[0.2em] uppercase font-bold mt-0.5 font-['Inter',system-ui,sans-serif]">
                  Sistema Interno de Gestión
                </p>
              </div>
            </div>

            {/* Premium Card container */}
            <div className="bg-white border border-[#c5c6cf]/40 rounded-2xl shadow-xl shadow-[#031636]/5 p-6 md:p-8">
              
              {/* Greeting */}
              <div className="text-center mb-5">
                <h3 className="text-xl lg:text-2xl font-extrabold text-[#191c1e] font-['Fraunces',Georgia,serif]">
                  ¡Bienvenido de nuevo!
                </h3>
                <p className="text-xs text-[#44474e] mt-1">
                  Ingresa tus credenciales oficiales para acceder.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#44474e] block uppercase tracking-wider ml-1">
                    Correo Electrónico
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777f] group-focus-within:text-[#3b5ca1] transition-colors h-4 w-4" />
                    <input 
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full border border-[#c5c6cf] rounded-lg py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-[#3b5ca1] focus:border-[#3b5ca1] transition-all outline-none text-[#191c1e] placeholder:text-[#c5c6cf] bg-white text-sm"
                      placeholder="ejemplo@cnposeidon.pe"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#44474e] block uppercase tracking-wider ml-1">
                    Contraseña
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777f] group-focus-within:text-[#3b5ca1] transition-colors h-4 w-4" />
                    <input 
                      required
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="w-full border border-[#c5c6cf] rounded-lg py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-[#3b5ca1] focus:border-[#3b5ca1] transition-all outline-none text-[#191c1e] placeholder:text-[#c5c6cf] bg-white text-sm"
                      placeholder="••••••••"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#75777f] hover:text-[#031636] transition-colors"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#031636] text-white font-semibold py-2.5 rounded-lg shadow-md hover:bg-[#1a2b4c] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 tracking-wide disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isLoading ? "Conectando..." : "Ingresar al Panel"}
                  </button>
                </div>
              </form>

              {/* Footnote inside the card */}
              <div className="mt-6 pt-4 border-t border-[#c5c6cf]/30 text-center">
                <p className="text-[10px] text-[#75777f] uppercase tracking-widest">
                  Acceso restringido a personal autorizado.
                  <br />
                  © 2026 Club Poseidón
                </p>
              </div>
            </div>

          </motion.div>
        </div>
      </main>

      {/* Footer for mobile only */}
      <footer className="md:hidden w-full py-4 px-6 bg-white border-t border-[#c5c6cf]">
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-bold text-[#031636]">
            Club Náutico Poseidón
          </span>
          <p className="text-[10px] text-[#44474e] opacity-70">
            © 2026 - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
