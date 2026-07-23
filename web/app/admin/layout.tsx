import type { Metadata } from 'next';
import { AdminAuthProvider } from '@/lib/auth';
import { ToastProvider, ConfirmProvider } from '@/components/ui';
import { NotificationsProvider } from './_components/NotificationsContext';
import './admin.css';

export const metadata: Metadata = {
  title: 'GCM Tickets — Panel Administrativo | Grupo Milcien',
};

/**
 * Layout de todo el segmento `/admin` (panel de administración/TI). Provee,
 * en orden, el contexto de sesión admin ({@link AdminAuthProvider}), toasts,
 * diálogos de confirmación y el contexto de notificaciones — disponibles
 * para cualquier página bajo `/admin`.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-admin-light font-(family-name:--font-admin) text-admin-text dark:bg-admin-dark-bg dark:text-admin-dark-text">
      <AdminAuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <NotificationsProvider>{children}</NotificationsProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AdminAuthProvider>
    </div>
  );
}
