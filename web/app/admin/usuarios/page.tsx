'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { IconUsers } from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import type { Solicitud, Usuario } from '@/lib/types';
import { Header } from '../_components/Header';
import { LoginScreen } from '../_components/LoginScreen';
import { UsrStatsRow } from './_components/UsrStatsRow';
import { SolicitudesCard } from './_components/SolicitudesCard';
import { UsuariosList } from './_components/UsuariosList';
import { UserDetailModal } from './_components/UserDetailModal';

function UsuariosApp() {
  const { user, token, hasPermiso } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const canSolicitudes = hasPermiso('solicitudes');

  const { data: usuarios, mutate: mutateUsuarios } = useSWR<Usuario[]>(token ? ['/usuarios', token] : null, ([url]: [string]) => api<Usuario[]>(url, { token }));
  const { data: solicitudes, mutate: mutateSolicitudes } = useSWR<Solicitud[]>(canSolicitudes && token ? ['/solicitudes', token] : null, ([url]: [string]) => api<Solicitud[]>(url, { token }));

  const usuariosList = useMemo(() => usuarios || [], [usuarios]);
  const solicitudesList = useMemo(() => solicitudes || [], [solicitudes]);

  const [detailId, setDetailId] = useState<number | null>(null);
  const detailUser = usuariosList.find((u) => u.id === detailId) || null;

  async function reload() {
    await Promise.all([mutateUsuarios(), canSolicitudes ? mutateSolicitudes() : null]);
  }

  async function handleAprobar(id: number) {
    try {
      await api(`/solicitudes/${id}/aprobar`, { method: 'POST', token });
      showToast('Solicitud aprobada y cuenta creada');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? `Error: ${e.message}` : 'No se pudo aprobar');
    }
  }

  async function handleRechazar(id: number, motivo: string | null) {
    try {
      await api(`/solicitudes/${id}/rechazar`, { method: 'POST', token, body: { motivo } });
      showToast('Solicitud rechazada');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? `Error: ${e.message}` : 'No se pudo rechazar');
    }
  }

  async function handleToggleActivo(id: number, activo: boolean) {
    try {
      await api(`/usuarios/${id}/activo`, { method: 'PATCH', token, body: { activo } });
      showToast(`Usuario ${activo ? 'activado' : 'desactivado'}`);
      await mutateUsuarios();
    } catch (e) {
      showToast(e instanceof Error ? `Error: ${e.message}` : 'No se pudo actualizar');
    }
  }

  async function handleDelete(id: number) {
    try {
      await api(`/usuarios/${id}`, { method: 'DELETE', token });
      showToast('Usuario eliminado');
      await mutateUsuarios();
    } catch (e) {
      showToast(e instanceof Error ? `Error: ${e.message}` : 'No se pudo eliminar');
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5 text-[15px] font-bold">
            <IconUsers size={17} className="text-indigo-500" /> Gestión de usuarios
          </div>

          <UsrStatsRow usuarios={usuariosList} solicitudes={solicitudesList} />

          <SolicitudesCard canView={canSolicitudes} solicitudes={solicitudesList} onAprobar={handleAprobar} onRechazar={handleRechazar} />

          <UsuariosList
            usuarios={usuariosList}
            currentUsername={user?.username || ''}
            onView={setDetailId}
            onToggleActivo={handleToggleActivo}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <UserDetailModal
        key={detailId ?? 'closed'}
        open={detailId !== null}
        usuario={detailUser}
        onClose={() => setDetailId(null)}
        onOpenTicket={(ticketId) => router.push(`/admin?ticket=${encodeURIComponent(ticketId)}`)}
      />
    </div>
  );
}

export default function UsuariosPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <LoginScreen />;
  return <UsuariosApp />;
}
