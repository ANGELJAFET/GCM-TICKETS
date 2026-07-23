import type { Metadata } from 'next';
import { PortalAuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import './portal.css';

export const metadata: Metadata = {
  title: 'GCM Tickets — Portal de Soporte | Grupo Milcien',
};

/**
 * Layout de todo el segmento `/portal` (portal de empleados). Provee el
 * contexto de sesión de empleado ({@link PortalAuthProvider}) y toasts;
 * los `div.portal-blob` son decoración visual de fondo (ver `portal.css`).
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-portal-bg font-(family-name:--font-portal) text-portal-text dark:bg-portal-dark-bg dark:text-portal-dark-text">
      <div className="portal-blob portal-blob-1" />
      <div className="portal-blob portal-blob-2" />
      <PortalAuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </PortalAuthProvider>
    </div>
  );
}
