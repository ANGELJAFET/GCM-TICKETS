import clsx from 'clsx';
import { IconExchangeOff, IconPackage, IconUser, IconUserCheck, IconCalendarPlus, IconCalendarMinus, IconCheck, IconFileTypeDoc, IconClock, IconHistory, IconSearch } from '@tabler/icons-react';
import type { Loan } from '@/lib/types';

interface PrestamosViewProps {
  allCount: number;
  loans: Loan[];
  query: string;
  estado: string;
  onQueryChange: (q: string) => void;
  onEstadoChange: (e: string) => void;
  onReturnFull: (loanId: string) => void;
  onReturnPartial: (loanId: string) => void;
  onGenerateWord: (loanId: string) => void;
}

function LoanRow({ loan, onReturnFull, onReturnPartial, onGenerateWord }: { loan: Loan; onReturnFull: (id: string) => void; onReturnPartial: (id: string) => void; onGenerateWord: (id: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const devEst = loan.fechaDevolucionEstimada ? new Date(loan.fechaDevolucionEstimada) : null;
  const vencido = loan.estado === 'activo' && !!devEst && devEst < today;

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
        <div className="font-mono text-[11px] text-admin-text-sec">
          {loan.inventoryId} · <span className="font-extrabold text-admin-blue">{loan.id}</span>
        </div>
        {loan.cantidad > 1 && (
          <div className="font-mono text-[11px] text-admin-text-sec">
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
        <div className="flex items-center gap-1 text-[11px] text-admin-text-sec">
          <IconCalendarPlus size={10} /> {loan.fechaPrestamo}
        </div>
        {loan.fechaDevolucionEstimada && (
          <div className={clsx('flex items-center gap-1 text-[11px]', vencido ? 'font-semibold text-admin-red' : 'text-admin-text-sec')}>
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
        {vencido ? (
          <span className="rounded-full bg-admin-red-light px-2.25 py-0.75 text-[10px] font-bold text-admin-red uppercase">Vencido</span>
        ) : loan.estado === 'activo' ? (
          <span className="rounded-full bg-admin-amber-light px-2.25 py-0.75 text-[10px] font-bold text-admin-amber uppercase">Activo</span>
        ) : (
          <span className="rounded-full bg-admin-green-light px-2.25 py-0.75 text-[10px] font-bold text-admin-green uppercase">Devuelto</span>
        )}
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
        <button
          type="button"
          onClick={() => onGenerateWord(loan.id)}
          title={loan.estado === 'devuelto' ? 'Generar comprobante de devolución (Word)' : 'Generar comprobante de préstamo (Word)'}
          className="inline-flex items-center gap-1.25 rounded-lg border-[1.5px] border-admin-border bg-white px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-admin-text-sec hover:border-admin-blue hover:text-admin-blue dark:bg-admin-dark-alt"
        >
          <IconFileTypeDoc size={12} /> {loan.estado === 'devuelto' ? 'Comprobante devolución' : 'Comprobante'}
        </button>
      </div>
    </div>
  );
}

export function PrestamosView({ allCount, loans, query, estado, onQueryChange, onEstadoChange, onReturnFull, onReturnPartial, onGenerateWord }: PrestamosViewProps) {
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

  const activos = loans.filter((l) => l.estado === 'activo');
  const devueltos = loans.filter((l) => l.estado === 'devuelto');

  return (
    <div className="flex flex-col gap-5">
      {toolbar}
      {activos.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">
            <IconClock size={14} /> Activos — {activos.length}
          </div>
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
            {activos.map((l) => (
              <LoanRow key={l.id} loan={l} onReturnFull={onReturnFull} onReturnPartial={onReturnPartial} onGenerateWord={onGenerateWord} />
            ))}
          </div>
        </div>
      )}
      {devueltos.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-admin-text-sec uppercase after:h-px after:flex-1 after:bg-admin-border">
            <IconHistory size={14} /> Historial — {devueltos.length}
          </div>
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-[var(--shadow-adm-sm)] dark:border-white/10 dark:bg-admin-dark-surface">
            {devueltos.map((l) => (
              <LoanRow key={l.id} loan={l} onReturnFull={onReturnFull} onReturnPartial={onReturnPartial} onGenerateWord={onGenerateWord} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
