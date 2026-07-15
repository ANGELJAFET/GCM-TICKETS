import type { Metadata } from 'next';
import { AdminAuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
import { NotificationsProvider } from './_components/NotificationsContext';
import './admin.css';

export const metadata: Metadata = {
  title: 'GCM Tickets — Panel Administrativo | Grupo Milcien',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-admin-light font-(family-name:--font-admin) text-admin-text dark:bg-admin-dark-bg dark:text-admin-dark-text">
      <AdminAuthProvider>
        <ToastProvider>
          <NotificationsProvider>{children}</NotificationsProvider>
        </ToastProvider>
      </AdminAuthProvider>
    </div>
  );
}
