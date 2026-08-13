'use client';

/**
 * Autenticación del frontend: sesión guardada en `sessionStorage` (no
 * cookies), login contra `/api/auth/login`, y helpers de autorización por
 * rol/módulo que reflejan las reglas del backend (`middleware/auth.ts`).
 * Genera dos contextos independientes vía {@link makeAuthContext} — uno para
 * el panel admin y otro para el portal de empleados — cada uno con su propia
 * clave de almacenamiento, para que iniciar sesión en un portal no afecte al otro.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, UNAUTHORIZED_EVENT } from './api';

export interface AuthUser {
  id: number;
  /** El endpoint de login no devuelve el username — se guarda el que se tecleó
   *  en el formulario, igual que el admin.js original (sessionStorage USERNAME_KEY). */
  username: string;
  nombre: string;
  rol: string;
  rol_nivel: number;
  acceso_inventario: boolean;
  acceso_prestamos: boolean;
  acceso_bitacora: boolean;
  acceso_solicitudes: boolean;
  acceso_usuarios: boolean;
}

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  /** true mientras se restaura la sesión desde sessionStorage al cargar la página. */
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  /** superadmin (rol_nivel >= 4) siempre tiene acceso a todos los módulos. */
  isSuperAdmin: () => boolean;
  hasPermiso: (modulo: 'inventario' | 'prestamos' | 'bitacora' | 'solicitudes' | 'usuarios') => boolean;
}

const MODULO_A_CAMPO = {
  inventario: 'acceso_inventario',
  prestamos: 'acceso_prestamos',
  bitacora: 'acceso_bitacora',
  solicitudes: 'acceso_solicitudes',
  usuarios: 'acceso_usuarios',
} as const;

/**
 * Genera un par `{ AuthProvider, useAuth }` aislado, con su propia clave de
 * `sessionStorage` y su propio React Context.
 * @param namespace Prefijo de la clave de `sessionStorage` (`'admin' | 'portal'`).
 * @param portalParam Valor enviado como `portal` en el body de `POST /auth/login`, usado por el backend para validar que el rol corresponde al portal.
 * @returns `{ AuthProvider, useAuth }` — el provider de contexto y el hook para consumirlo.
 */
function makeAuthContext(namespace: 'admin' | 'portal', portalParam: 'admin' | 'empleado') {
  const STORAGE_KEY = `gcm_${namespace}_session`;
  // Clave del OTRO portal: al iniciar sesión en uno se limpia el otro, para que
  // en un equipo compartido no queden dos sesiones activas a la vez (ver login()).
  const OTHER_KEY = `gcm_${namespace === 'admin' ? 'portal' : 'admin'}_session`;
  // Nivel de rol que corresponde a este portal (el backend ya lo valida en el
  // login: admin/panel = rol_nivel >= 2, empleado/portal = rol_nivel < 2). Se
  // reverifica en el cliente como defensa en profundidad al restaurar la sesión.
  const roleMatchesPortal = (u: AuthUser) => (portalParam === 'admin' ? u.rol_nivel >= 2 : u.rol_nivel < 2);
  const Ctx = createContext<AuthContextValue | null>(null);

  function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<StoredSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredSession;
          // Sólo se restaura si el rol corresponde a este portal; una sesión que
          // no coincide (p. ej. manipulada o de otro portal) se descarta.
          if (parsed?.user && roleMatchesPortal(parsed.user)) setSession(parsed);
          else sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // sesión corrupta o sessionStorage no disponible — se trata como no autenticado.
      }
      setLoading(false);
    }, []);

    const logout = useCallback(() => {
      setSession(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // no-op
      }
    }, []);

    useEffect(() => {
      // El backend responde 401 si el JWT expiró o es inválido — se cierra
      // sesión automáticamente, igual que el api() original.
      window.addEventListener(UNAUTHORIZED_EVENT, logout);
      return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
    }, [logout]);

    const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
      try {
        const res = await api<{
          ok: true;
          token: string;
          id: number;
          nombre: string;
          rol: string;
          rol_nivel: number;
          acceso_inventario: boolean;
          acceso_prestamos: boolean;
          acceso_bitacora: boolean;
          acceso_solicitudes: boolean;
          acceso_usuarios: boolean;
        }>('/auth/login', { method: 'POST', body: { username, password, portal: portalParam } });

        const user: AuthUser = {
          id: res.id,
          username,
          nombre: res.nombre,
          rol: res.rol,
          rol_nivel: res.rol_nivel,
          acceso_inventario: res.acceso_inventario,
          acceso_prestamos: res.acceso_prestamos,
          acceso_bitacora: res.acceso_bitacora,
          acceso_solicitudes: res.acceso_solicitudes,
          acceso_usuarios: res.acceso_usuarios,
        };
        const next: StoredSession = { token: res.token, user };
        setSession(next);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          // Cierra cualquier sesión del otro portal en este navegador: un mismo
          // equipo no debe quedar con sesión de admin y de empleado a la vez.
          sessionStorage.removeItem(OTHER_KEY);
        } catch {
          // no-op
        }
        return { ok: true };
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error de conexión con el servidor';
        return { ok: false, error: message };
      }
    }, []);

    const isSuperAdmin = useCallback(() => (session?.user.rol_nivel ?? 0) >= 4, [session]);

    const hasPermiso = useCallback(
      (modulo: keyof typeof MODULO_A_CAMPO) => {
        if (!session) return false;
        if (session.user.rol_nivel >= 4) return true;
        return !!session.user[MODULO_A_CAMPO[modulo]];
      },
      [session]
    );

    const value = useMemo<AuthContextValue>(
      () => ({
        user: session?.user ?? null,
        token: session?.token ?? null,
        loading,
        login,
        logout,
        isSuperAdmin,
        hasPermiso,
      }),
      [session, loading, login, logout, isSuperAdmin, hasPermiso]
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  /** Hook para consumir el contexto de autenticación. @throws Si se usa fuera de su `AuthProvider` correspondiente. */
  function useAuth(): AuthContextValue {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error(`useAuth debe usarse dentro de un AuthProvider (${namespace})`);
    return ctx;
  }

  return { AuthProvider, useAuth };
}

export const { AuthProvider: AdminAuthProvider, useAuth: useAdminAuth } = makeAuthContext('admin', 'admin');
export const { AuthProvider: PortalAuthProvider, useAuth: usePortalAuth } = makeAuthContext('portal', 'empleado');
