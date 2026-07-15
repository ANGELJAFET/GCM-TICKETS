// NEXT_PUBLIC_API_URL es un override explícito (ej. dominio de API distinto
// en producción). Si no está definida, la URL se arma en base al host desde
// el que el navegador cargó la página — "localhost" fijo no sirve porque
// este mismo frontend se accede desde otros equipos de la LAN por IP (ej. el
// celular que escanea el QR de "subir evidencia"), y "localhost" ahí
// apuntaría al propio celular en vez de al servidor.
const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '3000';

function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
  }
  return `http://localhost:${API_PORT}/api`;
}

const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** `body` ya es un FormData (subida de archivos) — no serializar ni fijar Content-Type. */
  isFormData?: boolean;
}

// Se dispara cuando el backend responde 401 (token ausente/expirado). Cada
// AuthProvider (admin/portal) se suscribe para cerrar sesión automáticamente,
// replicando el `if (res.status === 401) logout()` del api() original.
export const UNAUTHORIZED_EVENT = 'gcm:unauthorized';

function emitUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

function errorMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string') {
    return (data as Record<string, string>).error;
  }
  return undefined;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, isFormData } = opts;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401) emitUnauthorized();

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(errorMessage(data) || `Error ${res.status}`, res.status);
  }
  return data as T;
}

export { API_URL };
