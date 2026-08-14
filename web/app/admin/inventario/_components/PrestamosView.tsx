import clsx from 'clsx';
import { IconExchangeOff, IconPackage, IconPackages, IconUser, IconUserCheck, IconCalendarPlus, IconCalendarMinus, IconCheck, IconFileTypeDoc, IconClock, IconHistory, IconSearch, IconPencil, IconInfinity } from '@tabler/icons-react';
import type { Loan } from '@/lib/types';
import { DateRangeFilter } from './DateRangeFilter';

interface PrestamosViewProps {
  allCount: number;
  loans: Loan[];
  query: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  onQueryChange: (q: string) => void;
  onEstadoChange: (e: string) => void;
  onFechaDesdeChange: (v: string) => void;
  onFechaHastaChange: (v: string) => void;
  onReturnFull: (loanId: string) => void;
  onReturnPartial: (loanId: string) => void;
  onReturnGroup: (grupoId: string) => void;
  onEdit: (loanId: string) => void;
  onGenerateWord: (loanId: string) => void;
}

/** ¿El préstamo está activo y venció su fecha estimada de devolución? Las asignaciones permanentes nunca vencen. */
function isVencido(loan: Loan): boolean {
  if (loan.permanente) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const devEst = loan.fechaDevolucionEstimada ? new Date(loan.fechaDevolucionEstimada) : null;
  return loan.estado === 'activo' && !!devEst && devEst < today;
}

/** Etiqueta de estado (Permanente / Vencido / Activo / Devuelto). */
function EstadoBadge({ vencido, activo, permanente }: { vencido: boolean; activo: boolean; permanente?: boolean }) {
  if (activo && permanente)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-admin-purple-light px-2.25 py-0.75 text-[10px] font-bold text-admin-purple uppercase">
        <IconInfinity size={11} /> Permanente
      </span>
    );
  if (vencido) return <span className="rounded-full bg-admin-red-light px-2.25 py-0.75 text-[10px] font-bold text-admin-red uppercase">Vencido</span>;
  if (activo) return <span className="rounded-full bg-admin-amber-light px-2.25 py-0.75 text-[10px] font-bold text-admin-amber uppercase">Activo</span>;
  return <span className="rounded-full bg-admin-green-light px-2.25 py-0.75 text-[10px] font-bold text-admin-green uppercase">Devuelto</span>;
}

/** Fila de un préstamo individual (sin grupo). Ofrece devolución total o parcial y generación del comprobante Word. */
function LoanRow({ loan, onReturnFull, onReturnPartial, onEdit, onGenerateWord }: { loan: Loan; onReturnFull: (id: string) => void; onReturnPartial: (id: string) => void; onEdit: (id: string) => void; onGenerateWord: (id: string) => void }) {
  const vencido = isVencido(loan);

  return (
    <div
      className={clsx(
        'grid grid-cols-[44px_1fr_160px_160px_100px_auto] items-center gap-3 border-b border-admin-border px-4.5 py-3.5 transition-colors max-[1100px]:grid-cols-[44px_1fr_130px_auto_auto] max-[700px]:grid-cols-[44px_1fr_auto_auto] last:border-b-0 dark:border-white/10',
        vencido ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/20' : 'hover:bg-admin-light dark:hover:bg-admin-dark-alt'
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-blue-light text-admin-blue dark:bg-admin-blue/15">
        <IconPackage size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold">{loan.equipoDesc || loan.inventoryId}</div>
        <div className="font-mono text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
          {loan.inventoryId} · <span className="font-extrabold text-admin-blue">{loan.id}</span>
        </div>
        {loan.cantidad > 1 && (
          <div className="font-mono text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
            Cantidad: {loan.cantidad} · Devuelto: {loan.cantidadDevuelta}
            {loan.estado === 'activo' ? ` · Pendiente: ${loan.cantidad - loan.cantidadDevuelta}` : ''}
          </div>
        )}
      </div>
      <div className="max-[700px]:hidden">
        <div className="flex items-center gap-1 text-[13px] font-semibold">
          <IconUser size={11} /> {loan.empleado}
        </div>
        {loan.departamento && <div className="mt-0.5 text-[11px] text-admin-gray">{loan.departamento}</div>}
        {loan.autorizadoPor && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-admin-gray">
            <IconUserCheck size={10} /> Autorizado por: {loan.autorizadoPor}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.75 max-[1100px]:hidden">
        <div className="flex items-center gap-1 text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
          <IconCalendarPlus size={10} /> {loan.fechaPrestamo}
        </div>
        {loan.fechaDevolucionEstimada && (
          <div className={clsx('flex items-center gap-1 text-[11px]', vencido ? 'font-semibold text-admin-red dark:text-red-300' : 'text-admin-text-sec dark:text-admin-dark-text-sec')}>
            <IconCalendarMinus size={10} /> Est. {loan.fechaDevolucionEstimada}
          </div>
        )}
        {loan.fechaDevolucionReal && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-admin-green">
            <IconCheck size={10} /> Devuelto: {loan.fechaDevolucionReal}
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <EstadoBadge vencido={vencido} activo={loan.estado === 'activo'} permanente={loan.permanente} />
      </div>
      <div className="flex flex-col gap-1.5">
        {loan.estado === 'activo' &&
          (loan.cantidad > 1 ? (
            <button type="button" onClick={() => onReturnPartial(loan.id)} className="inline-flex items-center gap-1.25 rounded-lg bg-linear-to-br from-emerald-600 to-admin-green px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-white">
              <IconCheck size={12} /> Devolver ({loan.cantidad - loan.cantidadDevuelta} pend.)
            </button>
          ) : (
            <button type="button" onClick={() => onReturnFull(loan.id)} className="inline-flex items-center gap-1.25 rounded-lg bg-linear-to-br from-emerald-600 to-admin-green px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-white">
              <IconCheck size={12} /> Retornado
            </button>
          ))}
        {loan.estado === 'activo' && (
          <button type="button" onClick={() => onEdit(loan.id)} className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-alt dark:text-admin-dark-text-sec">
            <IconPencil size={12} /> Editar
          </button>
        )}
        <button
          type="button"
          onClick={() => onGenerateWord(loan.id)}
          title={loan.estado === 'devuelto' ? 'Generar comprobante de devolución (Word)' : 'Generar comprobante de préstamo (Word)'}
          className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-alt dark:text-admin-dark-text-sec"
        >
          <IconFileTypeDoc size={12} /> {loan.estado === 'devuelto' ? 'Comprobante devolución' : 'Comprobante'}
        </button>
      </div>
    </div>
  );
}

/** Tarjeta de un préstamo agrupado: varios equipos entregados juntos a la misma persona (un solo comprobante y devolución conjunta). */
function GroupCard({ grupoId, loans, onReturnGroup, onEdit, onGenerateWord }: { grupoId: string; loans: Loan[]; onReturnGroup: (grupoId: string) => void; onEdit: (loanId: string) => void; onGenerateWord: (loanId: string) => void }) {
  const base = loans[0];
  const anyActive = loans.some((l) => l.estado === 'activo');
  const anyVencido = loans.some((l) => isVencido(l));

  return (
    <div className={clsx('border-b border-admin-border px-4.5 py-3.5 last:border-b-0 dark:border-white/10', anyVencido ? 'bg-red-50 dark:bg-red-950/20' : '')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-blue-light text-admin-blue dark:bg-admin-blue/15">
              <IconPackages size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold">
                {loans.length} equipos · <span className="font-extrabold text-admin-blue">{grupoId}</span>
              </div>
              <div className="flex items-center gap-1 text-[12.5px] font-semibold">
                <IconUser size={11} /> {base.empleado}
                {base.departamento && <span className="font-normal text-admin-gray"> · {base.departamento}</span>}
              </div>
            </div>
            <div className="ml-auto">
              <EstadoBadge vencido={anyVencido} activo={anyActive} permanente={base.permanente} />
            </div>
          </div>

          <ul className="mt-2 flex flex-col gap-1 pl-1">
            {loans.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                <IconPackage size={12} className="shrink-0 text-admin-gray" />
                <span className="font-semibold">{l.equipoDesc || l.inventoryId}</span>
                <span className="font-mono text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
                  {l.inventoryId}
                  {l.cantidad > 1 ? ` · x${l.cantidad}` : ''}
                </span>
                {l.estado === 'devuelto' && <span className="text-[10px] font-bold text-admin-green uppercase">Devuelto</span>}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 pl-1">
            <span className="flex items-center gap-1 text-[11px] text-admin-text-sec dark:text-admin-dark-text-sec">
              <IconCalendarPlus size={10} /> {base.fechaPrestamo}
            </span>
            {base.fechaDevolucionEstimada && (
              <span className={clsx('flex items-center gap-1 text-[11px]', anyVencido ? 'font-semibold text-admin-red dark:text-red-300' : 'text-admin-text-sec dark:text-admin-dark-text-sec')}>
                <IconCalendarMinus size={10} /> Est. {base.fechaDevolucionEstimada}
              </span>
            )}
            {base.autorizadoPor && (
              <span className="flex items-center gap-1 text-[11px] text-admin-gray">
                <IconUserCheck size={10} /> Autorizado por: {base.autorizadoPor}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {anyActive && (
            <button type="button" onClick={() => onReturnGroup(grupoId)} className="inline-flex items-center gap-1.25 rounded-lg bg-linear-to-br from-emerald-600 to-admin-green px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-white">
              <IconCheck size={12} /> Devolver todo
            </button>
          )}
          {anyActive && (
            <button type="button" onClick={() => onEdit(base.id)} className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-alt dark:text-admin-dark-text-sec">
              <IconPencil size={12} /> Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => onGenerateWord(base.id)}
            title={anyActive ? 'Generar comprobante de préstamo (Word)' : 'Generar comprobante de devolución (Word)'}
            className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-alt dark:text-admin-dark-text-sec"
          >
            <IconFileTypeDoc size={12} /> {anyActive ? 'Comprobante' : 'Comprobante devolución'}
          </button>
        </div>
      </div>
    </div>
  );
}

type Entry = { type: 'single'; loan: Loan } | { type: 'group'; grupoId: string; loans: Loan[] };

/** Agrupa los préstamos por `grupoId` conservando el orden; los sueltos quedan individuales. */
function buildEntries(loans: Loan[]): Entry[] {
  const entries: Entry[] = [];
  const groupIndex = new Map<string, number>();
  for (const l of loans) {
    if (!l.grupoId) {
      entries.push({ type: 'single', loan: l });
      continue;
    }
    const idx = groupIndex.get(l.grupoId);
    if (idx === undefined) {
      groupIndex.set(l.grupoId, entries.length);
      entries.push({ type: 'group', grupoId: l.grupoId, loans: [l] });
    } else {
      (entries[idx] as { type: 'group'; grupoId: string; loans: Loan[] }).loans.push(l);
    }
  }
  return entries;
}

/** ¿Una entrada (préstamo suelto o grupo) sigue activa (algún equipo sin devolver)? */
function entryActiva(e: Entry): boolean {
  return e.type === 'single' ? e.loan.estado === 'activo' : e.loans.some((l) => l.estado === 'activo');
}

function renderEntry(e: Entry, props: Pick<PrestamosViewProps, 'onReturnFull' | 'onReturnPartial' | 'onReturnGroup' | 'onEdit' | 'onGenerateWord'>) {
  if (e.type === 'single') {
    return <LoanRow key={e.loan.id} loan={e.loan} onReturnFull={props.onReturnFull} onReturnPartial={props.onReturnPartial} onEdit={props.onEdit} onGenerateWord={props.onGenerateWord} />;
  }
  return <GroupCard key={e.grupoId} grupoId={e.grupoId} loans={e.loans} onReturnGroup={props.onReturnGroup} onEdit={props.onEdit} onGenerateWord={props.onGenerateWord} />;
}

/** Vista "Préstamos": buscador + filtro de estado, y listado separado en "Activos" e "Historial" (devueltos). Los equipos prestados juntos se muestran agrupados. */
export function PrestamosView({ allCount, loans, query, estado, fechaDesde, fechaHasta, onQueryChange, onEstadoChange, onFechaDesdeChange, onFechaHastaChange, onReturnFull, onReturnPartial, onReturnGroup, onEdit, onGenerateWord }: PrestamosViewProps) {
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-50 flex-1">
        <IconSearch size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-admin-gray" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por equipo, empleado, departamento, N° de préstamo…"
          className="h-9.5 w-full rounded-[10px] border-[1.5px] border-admin-border bg-admin-light pr-3.5 pl-9.5 text-[13px] outline-none focus:border-admin-blue focus:bg-white dark:border-white/10 dark:bg-admin-dark-bg dark:focus:bg-admin-dark-bg"
        />
      </div>
      <select
        value={estado}
        onChange={(e) => onEstadoChange(e.target.value)}
        className="h-9.5 rounded-[10px] border-[1.5px] border-admin-border bg-admin-light px-3 text-[13px] outline-none focus:border-admin-blue dark:border-white/10 dark:bg-admin-dark-bg"
      >
        <option value="">Todos los estados</option>
        <option value="activo">Activos</option>
        <option value="devuelto">Devueltos</option>
      </select>
      <DateRangeFilter label="Préstamo" desde={fechaDesde} hasta={fechaHasta} onDesde={onFechaDesdeChange} onHasta={onFechaHastaChange} />
    </div>
  );

  if (!allCount) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-5 py-15 text-center text-admin-gray">
        <IconExchangeOff size={56} className="opacity-20" />
        <p className="text-sm">No hay préstamos registrados aún.</p>
      </div>
    );
  }

  if (!loans.length) {
    return (
      <div className="flex flex-col gap-5">
        {toolbar}
        <div className="flex flex-col items-center gap-3.5 px-5 py-15 text-center text-admin-gray">
          <IconExchangeOff size={56} className="opacity-20" />
          <p className="text-sm">No hay préstamos que coincidan con los filtros.</p>
        </div>
      </div>
    );
  }

  const entries = buildEntries(loans);
  const activos = entries.filter(entryActiva);
  const devueltos = entries.filter((e) => !entryActiva(e));
  const handlers = { onReturnFull, onReturnPartial, onReturnGroup, onEdit, onGenerateWord };

  return (
    <div className="flex flex-col gap-5">
      {toolbar}
      {activos.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border dark:text-admin-dark-text-sec">
            <IconClock size={14} /> Activos — {activos.length}
          </div>
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
            {activos.map((e) => renderEntry(e, handlers))}
          </div>
        </div>
      )}
      {devueltos.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border dark:text-admin-dark-text-sec">
            <IconHistory size={14} /> Historial — {devueltos.length}
          </div>
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
            {devueltos.map((e) => renderEntry(e, handlers))}
          </div>
        </div>
      )}
    </div>
  );
}
