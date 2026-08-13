'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconShieldCheck } from '@tabler/icons-react';
import { usePortalAuth } from '@/lib/auth';
import { AuthShell } from '@/components/auth/AuthShell';

/**
 * Pantalla de login del portal de empleados. Envía las credenciales vía
 * {@link usePortalAuth}, que llama a `POST /api/auth/login` con
 * `portal: 'empleado'`; enlaza a `/registro` para quien aún no tiene cuenta.
 */
export function IdentScreen() {
  const { login } = usePortalAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(username: string, password: string) {
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.ok) setError(res.error || 'Error al iniciar sesión.');
  }

  return (
    <AuthShell
      accent="portal"
      brandTitle="GCM Tickets"
      brandSubtitle={
        <>
          Portal de Soporte Técnico
          <br />
          Grupo Milcien S.A. de C.V.
        </>
      }
      badge={{ icon: <IconShieldCheck size={14} />, text: 'Sistema interno corporativo' }}
      formTitle="Bienvenido"
      formSubtitle="Ingresa tus credenciales para continuar"
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      submitLabel="Iniciar sesión"
      footer={
        <div className="flex flex-col gap-1.5">
          <span className="text-portal-text-sec dark:text-admin-dark-text-sec">
            ¿Sin cuenta?{' '}
            <Link
              href="/registro"
              className="rounded font-semibold text-portal-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal-navy dark:text-portal-navy-light dark:hover:text-white dark:focus-visible:outline-portal-navy-light"
            >
              Solicitar acceso
            </Link>
          </span>
          <span className="text-portal-text-sec dark:text-admin-dark-text-sec">
            ¿Olvidaste tu contraseña? Contacta al Depto. de Sistemas / TI
          </span>
        </div>
      }
    />
  );
}
