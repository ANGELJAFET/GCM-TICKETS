'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { IconArrowLeft, IconPackage, IconLock } from '@tabler/icons-react';
import { useAdminAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useToast, useConfirm } from '@/components/ui';
import type { AdminUser, InvCondicion, InventoryItem, Loan, UsuarioListado } from '@/lib/types';
import { Header } from '../_components/Header';
import { LoginScreen } from '../_components/LoginScreen';
import { InvStatsRow } from './_components/InvStatsRow';
import { InvToolbar, type InvView } from './_components/InvToolbar';
import { DashboardView } from './_components/DashboardView';
import { EquiposView } from './_components/EquiposView';
import { PrestamosView } from './_components/PrestamosView';
import { ResponsablesView } from './_components/ResponsablesView';
import { InventoryModal, type InventoryFormValues } from './_components/InventoryModal';
import { LoanModal, type LoanFormValues } from './_components/LoanModal';
import { SimilarEquiposModal } from './_components/SimilarEquiposModal';
import { ReturnConfirmModal, PartialReturnModal } from './_components/ReturnModals';
import { filterInventory, filterLoans, invGroupKey } from './_lib/invHelpers';
import { generateLoanWord } from './_lib/generateLoanWord';
import { generateReturnWord } from './_lib/generateReturnWord';

/**
 * Página `/admin/inventario`: orquesta las cuatro vistas del módulo
 * (dashboard, equipos, préstamos, responsables/asignaciones) y todos los
 * modales asociados (alta/edición de equipo, registro de préstamo, equipos
 * similares, devolución total/parcial). Requiere el permiso `'inventario'`
 * y/o `'prestamos'`; sin ninguno de los dos, muestra un aviso de acceso
 * restringido en vez del contenido. Los comprobantes de préstamo/devolución
 * se generan en cliente como `.docx` vía `generateLoanWord`/`generateReturnWord`.
 */
function InventarioApp() {
  const { user, token, hasPermiso } = useAdminAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const canEquipos = hasPermiso('inventario');
  const canPrestamos = hasPermiso('prestamos');

  const { data: inventory, mutate: mutateInventory } = useSWR<InventoryItem[]>(
    canEquipos && token ? ['/inventory', token] : null,
    ([url]: [string]) => api<InventoryItem[]>(url, { token })
  );
  const { data: loans, mutate: mutateLoans } = useSWR<Loan[]>(canPrestamos && token ? ['/loans', token] : null, ([url]: [string]) => api<Loan[]>(url, { token }));
  const { data: usuariosLista } = useSWR<UsuarioListado[]>(token ? ['/usuarios/lista', token] : null, ([url]: [string]) => api<UsuarioListado[]>(url, { token }));
  const { data: admins } = useSWR<AdminUser[]>(token ? ['/admins', token] : null, ([url]: [string]) => api<AdminUser[]>(url, { token }));

  const items = useMemo(() => inventory || [], [inventory]);
  const loanList = useMemo(() => loans || [], [loans]);
  const usuarios = useMemo(() => usuariosLista || [], [usuariosLista]);
  const adminList = useMemo(() => admins || [], [admins]);

  const [view, setView] = useState<InvView>('dashboard');
  const [query, setQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [loanQuery, setLoanQuery] = useState('');
  const [loanEstadoFilter, setLoanEstadoFilter] = useState('');

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanPreselectId, setLoanPreselectId] = useState<string | null>(null);

  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarKey, setSimilarKey] = useState<string | null>(null);

  const [returnConfirmLoan, setReturnConfirmLoan] = useState<Loan | null>(null);
  const [partialReturnLoan, setPartialReturnLoan] = useState<Loan | null>(null);

  const filteredEquipos = useMemo(() => filterInventory(items, query, estadoFilter), [items, query, estadoFilter]);
  const filteredLoans = useMemo(() => filterLoans(loanList, loanQuery, loanEstadoFilter), [loanList, loanQuery, loanEstadoFilter]);
  const activosCount = loanList.filter((l) => l.estado === 'activo').length;

  function goToEquipos(estado: string, tipo?: string) {
    if (!canEquipos) return;
    setView('equipos');
    setEstadoFilter(estado || '');
    setQuery(tipo || '');
  }

  async function reload() {
    await Promise.all([canEquipos ? mutateInventory() : null, canPrestamos ? mutateLoans() : null]);
  }

  async function handleSaveInventory(id: string | null, values: InventoryFormValues) {
    const body: Record<string, unknown> = {
      tipo: values.tipo.trim(),
      marca: values.marca.trim(),
      modelo: values.modelo.trim(),
      color: values.color.trim(),
      condicion: values.condicion,
      estado: values.estado,
      ubicacion: values.ubicacion.trim(),
      responsable: values.responsable.trim(),
      notas: values.notas.trim(),
      garantia: values.garantia,
    };
    if (values.mobileToken) body.mobileToken = values.mobileToken;
    if (values.tipoManejo === 'cantidad') body.cantidadTotal = parseInt(values.cantidadTotal, 10);
    else body.serie = values.serie.trim();

    if (id) {
      await api(`/inventory/${id}`, { method: 'PATCH', token, body });
      showToast('Equipo actualizado ✓');
    } else {
      body.tipoManejo = values.tipoManejo;
      await api('/inventory', { method: 'POST', token, body });
      showToast('Equipo agregado al inventario ✓');
    }
    setInvModalOpen(false);
    setEditingItem(null);
    await reload();
  }

  async function handleDeleteInventory(id: string) {
    const item = items.find((i) => i.id === id);
    const ok = await confirm({
      title: 'Eliminar del inventario',
      message: `¿Eliminar "${item?.marca} ${item?.modelo || ''}" (${id}) del inventario?\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/inventory/${id}`, { method: 'DELETE', token });
      showToast('Equipo eliminado del inventario');
      await reload();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Error al eliminar');
    }
  }

  async function handleSaveLoan(values: LoanFormValues) {
    await api('/loans', {
      method: 'POST',
      token,
      body: {
        inventoryId: values.inventoryId,
        empleado: values.empleado.trim(),
        departamento: values.departamento.trim(),
        fechaDevolucion: values.fechaDevolucion || null,
        autorizadoPorId: values.autorizadoPorId ? parseInt(values.autorizadoPorId, 10) : null,
        notas: values.notas.trim(),
        cantidad: parseInt(values.cantidad, 10) || 1,
        mobileTokens: values.mobileTokens,
      },
    });
    showToast('Préstamo registrado ✓');
    setLoanModalOpen(false);
    setLoanPreselectId(null);
    await reload();
  }

  async function handleReturnFull(loanId: string) {
    const loan = loanList.find((l) => l.id === loanId);
    if (loan) setReturnConfirmLoan(loan);
  }

  async function confirmReturnFull(loanId: string, condicionDevolucion: InvCondicion, notaDevolucion: string) {
    await api(`/loans/${loanId}`, { method: 'PATCH', token, body: { estado: 'devuelto', condicionDevolucion, notaDevolucion: notaDevolucion || undefined } });
    showToast('Devolución registrada ✓');
    setReturnConfirmLoan(null);
    await reload();
  }

  function handleReturnPartial(loanId: string) {
    const loan = loanList.find((l) => l.id === loanId);
    if (loan) setPartialReturnLoan(loan);
  }

  async function confirmReturnPartial(loanId: string, cantidad: number, condicionDevolucion: InvCondicion, notaDevolucion: string) {
    await api(`/loans/${loanId}`, { method: 'PATCH', token, body: { cantidadDevuelta: cantidad, condicionDevolucion, notaDevolucion: notaDevolucion || undefined } });
    showToast('Devolución registrada ✓');
    setPartialReturnLoan(null);
    await reload();
  }

  function handleReturnByItem(itemId: string) {
    const loan = loanList.find((l) => l.inventoryId === itemId && l.estado === 'activo');
    if (!loan) {
      showToast('No se encontró préstamo activo');
      return;
    }
    handleReturnFull(loan.id);
  }

  async function handleGenerateWord(loanId: string) {
    const loan = loanList.find((l) => l.id === loanId);
    if (!loan) return showToast('Préstamo no encontrado');
    const item = items.find((i) => i.id === loan.inventoryId);
    try {
      if (loan.estado === 'devuelto') generateReturnWord(loan, item, user?.nombre || '');
      else await generateLoanWord(loan, item, user?.nombre || '');
      showToast('Comprobante generado ✓');
    } catch {
      showToast('Error al generar comprobante');
    }
  }

  function openSimilar(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setSimilarKey(invGroupKey(item));
    setSimilarOpen(true);
  }

  const similarItems = similarKey ? items.filter((i) => invGroupKey(i) === similarKey) : [];
  const similarNombre = similarItems[0] ? `${similarItems[0].marca}${similarItems[0].modelo ? ' ' + similarItems[0].modelo : ''}` : '';

  if (!canEquipos && !canPrestamos) {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-admin-text-sec dark:text-admin-dark-text-sec">
          <IconLock size={40} className="opacity-30" />
          <p>No tienes acceso al módulo de inventario.</p>
          <Link href="/admin" className="text-admin-blue hover:underline">
            Volver a tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Link href="/admin" className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-admin-border bg-admin-light px-4 py-1.75 text-[13px] font-semibold text-admin-text-sec hover:bg-admin-border/40 dark:border-white/10 dark:bg-admin-dark-surface dark:text-admin-dark-text-sec dark:hover:bg-admin-dark-alt">
              <IconArrowLeft size={15} /> Volver a tickets
            </Link>
            <span className="flex items-center gap-1.5 text-[15px] font-bold">
              <IconPackage size={17} /> Inventario
            </span>
          </div>

          <InvStatsRow items={items} onGoTo={goToEquipos} />

          <InvToolbar
            view={view}
            onChange={setView}
            canEquipos={canEquipos}
            canPrestamos={canPrestamos}
            activosCount={activosCount}
            onAdd={() => {
              if (view === 'equipos') {
                setEditingItem(null);
                setInvModalOpen(true);
              } else if (view === 'prestamos') {
                setLoanPreselectId(null);
                setLoanModalOpen(true);
              }
            }}
          />

          {view === 'dashboard' && (
            <DashboardView
              items={items}
              canEquipos={canEquipos}
              onAddFirst={() => {
                setView('equipos');
                setEditingItem(null);
                setInvModalOpen(true);
              }}
              onGoTo={goToEquipos}
            />
          )}
          {view === 'equipos' && canEquipos && (
            <EquiposView
              allCount={items.length}
              items={filteredEquipos}
              query={query}
              estado={estadoFilter}
              onQueryChange={setQuery}
              onEstadoChange={setEstadoFilter}
              onAdd={() => {
                setEditingItem(null);
                setInvModalOpen(true);
              }}
              onOpenSimilar={openSimilar}
              onLoan={(id) => {
                setLoanPreselectId(id);
                setLoanModalOpen(true);
              }}
              onReturn={handleReturnByItem}
              onEdit={(id) => {
                const item = items.find((i) => i.id === id);
                if (item) {
                  setEditingItem(item);
                  setInvModalOpen(true);
                }
              }}
              onDelete={handleDeleteInventory}
            />
          )}
          {view === 'prestamos' && canPrestamos && (
            <PrestamosView
              allCount={loanList.length}
              loans={filteredLoans}
              query={loanQuery}
              estado={loanEstadoFilter}
              onQueryChange={setLoanQuery}
              onEstadoChange={setLoanEstadoFilter}
              onReturnFull={handleReturnFull}
              onReturnPartial={handleReturnPartial}
              onGenerateWord={handleGenerateWord}
            />
          )}
          {view === 'asignaciones' && canPrestamos && (
            <ResponsablesView
              items={items}
              onEdit={(id) => {
                const item = items.find((i) => i.id === id);
                if (item) {
                  setEditingItem(item);
                  setInvModalOpen(true);
                }
              }}
            />
          )}
        </div>
      </div>

      <InventoryModal
        key={invModalOpen ? (editingItem?.id ?? 'new') : 'closed'}
        open={invModalOpen}
        editingItem={editingItem}
        usuarios={usuarios}
        onClose={() => {
          setInvModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveInventory}
      />

      <LoanModal
        key={loanModalOpen ? (loanPreselectId ?? 'new') : 'closed'}
        open={loanModalOpen}
        preselectedItemId={loanPreselectId}
        inventory={items}
        usuarios={usuarios}
        admins={adminList}
        onClose={() => {
          setLoanModalOpen(false);
          setLoanPreselectId(null);
        }}
        onSave={handleSaveLoan}
      />

      <SimilarEquiposModal
        open={similarOpen}
        items={similarItems}
        nombre={similarNombre}
        onClose={() => setSimilarOpen(false)}
        onOpenSimilar={openSimilar}
        onLoan={(id) => {
          setSimilarOpen(false);
          setLoanPreselectId(id);
          setLoanModalOpen(true);
        }}
        onReturn={(id) => {
          setSimilarOpen(false);
          handleReturnByItem(id);
        }}
        onEdit={(id) => {
          const item = items.find((i) => i.id === id);
          if (item) {
            setSimilarOpen(false);
            setEditingItem(item);
            setInvModalOpen(true);
          }
        }}
        onDelete={handleDeleteInventory}
      />

      <ReturnConfirmModal
        key={returnConfirmLoan?.id ?? 'closed'}
        open={!!returnConfirmLoan}
        loan={returnConfirmLoan}
        item={returnConfirmLoan ? items.find((i) => i.id === returnConfirmLoan.inventoryId) : undefined}
        onClose={() => setReturnConfirmLoan(null)}
        onConfirm={confirmReturnFull}
      />

      <PartialReturnModal
        key={partialReturnLoan?.id ?? 'closed'}
        open={!!partialReturnLoan}
        loan={partialReturnLoan}
        item={partialReturnLoan ? items.find((i) => i.id === partialReturnLoan.inventoryId) : undefined}
        onClose={() => setPartialReturnLoan(null)}
        onConfirm={confirmReturnPartial}
      />
    </div>
  );
}

/** Página `/admin/inventario`. Muestra {@link LoginScreen} si no hay sesión, o {@link InventarioApp} si la hay. */
export default function InventarioPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <LoginScreen />;
  return <InventarioApp />;
}
