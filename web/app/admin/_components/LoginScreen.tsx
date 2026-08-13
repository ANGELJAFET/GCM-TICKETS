'use client';

import { useState } from 'react';
import { IconShieldLock } from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { AuthShell } from '@/components/auth/AuthShell';

/**
 * Pantalla de login del panel admin (mostrada por `admin/page.tsx` cuando no
 * hay sesión activa). Envía las credenciales vía {@link useAdminAuth}, que
 * llama a `POST /api/auth/login` con `portal: 'admin'`.
 */
export function LoginScreen() {
  const { login } = useAdminAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(username: string, password: string) {
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Usuario o contraseña incorrectos');
    }
  }

  return (
    <AuthShell
      accent="admin"
      brandTitle="GCM Tickets"
      brandSubtitle={
        <>
          Panel Administrativo
          <br />
          Grupo Milcien S.A. de C.V.
        </>
      }
      badge={{ icon: <IconShieldLock size={14} />, text: 'Acceso restringido' }}
      formTitle="Iniciar sesión"
      formSubtitle="Solo personal de TI autorizado"
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      submitLabel="Ingresar al sistema"
      footer={
        <span className="text-portal-text-sec dark:text-admin-dark-text-sec">
          ¿Olvidaste tu contraseña? Contacta al Depto. de Sistemas / TI
        </span>
      }
    />
  );
}
