const BASE_URL = import.meta.env.VITE_API_URL;

// El gateway monta auth-service en /auth (no /api/auth): app.use('/auth', createAuthProxy())
const REFRESH_ENDPOINT = "/auth/refresh";

// Evita que, si varias peticiones fallan con 401 al mismo tiempo, se disparen
// múltiples renovaciones simultáneas del token. Todas las llamadas comparten
// la misma promesa de renovación en curso.
let refreshingPromise: Promise<string | null> | null = null;

async function renovarAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}${REFRESH_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.accessToken) {
      return null;
    }

    localStorage.setItem("accessToken", data.accessToken);
    return data.accessToken;
  } catch (error) {
    console.error("Error al renovar el access token:", error);
    return null;
  }
}

function limpiarSesionYRedirigir() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("id_rol");
  window.location.href = "/login";
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  _esReintento = false
): Promise<Response> {
  // ── INTERCEPTOR DE ENTRADA (Request) ──────────────────────────────────────
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  // ── PETICIÓN ──────────────────────────────────────────────────────────────
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // ── INTERCEPTOR DE SALIDA (Response) ──────────────────────────────────────
  if (response.status === 401) {
    // Si esta petición YA era un reintento tras renovar, no insistas más:
    // el refresh token también está vencido/revocado → cerrar sesión.
    if (_esReintento) {
      console.warn("Refresh token inválido o expirado. Redirigiendo al login...");
      limpiarSesionYRedirigir();
      return response;
    }

    console.warn("Access token expirado. Intentando renovar sesión...");

    // Comparte la misma renovación entre peticiones concurrentes
    if (!refreshingPromise) {
      refreshingPromise = renovarAccessToken().finally(() => {
        refreshingPromise = null;
      });
    }

    const nuevoAccessToken = await refreshingPromise;

    if (!nuevoAccessToken) {
      console.warn("No se pudo renovar el token. Redirigiendo al login...");
      limpiarSesionYRedirigir();
      return response;
    }

    // Reintenta la petición original UNA sola vez con el token nuevo
    return apiFetch(endpoint, options, true);
  }

  return response;
}
