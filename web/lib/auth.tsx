'use client';

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

function makeAuthContext(namespace: 'admin' | 'portal', portalParam: 'admin' | 'empleado') {
  const STORAGE_KEY = `gcm_${namespace}_session`;
  const Ctx = createContext<AuthContextValue | null>(null);

  function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<StoredSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) setSession(JSON.parse(raw));
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

  function useAuth(): AuthContextValue {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error(`useAuth debe usarse dentro de un AuthProvider (${namespace})`);
    return ctx;
  }

  return { AuthProvider, useAuth };
}

export const { AuthProvider: AdminAuthProvider, useAuth: useAdminAuth } = makeAuthContext('admin', 'admin');
export const { AuthProvider: PortalAuthProvider, useAuth: usePortalAuth } = makeAuthContext('portal', 'empleado');
