import { IconChevronLeft, IconChevronRight, IconSearchOff, IconUserCheck, IconUsers } from '@tabler/icons-react';
import clsx from 'clsx';
import type { Ticket } from '@/lib/types';
import { TicketCard } from './TicketCard';

const PAGE_SIZE = 10;

interface TicketListProps {
  list: Ticket[];
  currentTab: string;
  adminNombre: string;
  selectedId: string | null;
  currentPage: number;
  now: number;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}

function GroupHeader({ title, icon: Icon, count, mine }: { title: string; icon: typeof IconUserCheck; count: number; mine: boolean }) {
  return (
    <div
      className={clsx(
        'mt-4 mb-2 flex items-center justify-between rounded-[10px] border px-3.5 py-2 text-xs font-bold first:mt-0',
        mine ? 'border-blue-200 bg-admin-blue-light text-blue-700 dark:border-admin-blue/40 dark:bg-admin-blue/15 dark:text-admin-blue' : 'border-admin-border bg-admin-light text-admin-text-sec dark:border-white/10 dark:bg-admin-dark-alt'
      )}
    >
      <span className="flex items-center gap-1.75">
        <Icon size={14} /> {title}
      </span>
      <span className={clsx('rounded-full px-2.25 py-0.5 text-[11px] font-extrabold', mine ? 'bg-admin-blue text-white' : 'bg-black/8 dark:bg-white/10')}>{count}</span>
    </div>
  );
}

export function TicketList({ list, currentTab, adminNombre, selectedId, currentPage, now, onPageChange, onSelect }: TicketListProps) {
  if (!list.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-admin-text-sec">
        <IconSearchOff size={40} className="opacity-30" />
        <p>No se encontraron tickets</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageList = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  let body: React.ReactNode;
  if (currentTab !== 'todos') {
    const myAll = list.filter((t) => t.asignado === adminNombre);
    const otherAll = list.filter((t) => t.asignado !== adminNombre);
    const myPage = pageList.filter((t) => t.asignado === adminNombre);
    const otherPage = pageList.filter((t) => t.asignado !== adminNombre);
    body = (
      <>
        {myPage.length > 0 && (
          <>
            <GroupHeader title="Mis tickets" icon={IconUserCheck} count={myAll.length} mine />
            <div className="flex flex-col gap-2.5">
              {myPage.map((t) => (
                <TicketCard key={t.id} ticket={t} selected={t.id === selectedId} now={now} onClick={() => onSelect(t.id)} />
              ))}
            </div>
          </>
        )}
        {otherPage.length > 0 && (
          <>
            <GroupHeader title="Otros técnicos" icon={IconUsers} count={otherAll.length} mine={false} />
            <div className="flex flex-col gap-2.5">
              {otherPage.map((t) => (
                <TicketCard key={t.id} ticket={t} selected={t.id === selectedId} now={now} onClick={() => onSelect(t.id)} />
              ))}
            </div>
          </>
        )}
      </>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2.5">
        {pageList.map((t) => (
          <TicketCard key={t.id} ticket={t} selected={t.id === selectedId} now={now} onClick={() => onSelect(t.id)} />
        ))}
      </div>
    );
  }

  return (
    <>
      {body}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5 pb-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border-[1.5px] border-admin-border text-admin-text-sec transition-colors hover:border-admin-blue hover:text-admin-blue disabled:opacity-40"
          >
            <IconChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((i) => totalPages <= 7 || Math.abs(i - page) <= 2 || i === 1 || i === totalPages)
            .map((i, idx, arr) => (
              <span key={i} className="flex items-center gap-1.5">
                {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1 text-xs text-admin-text-sec">…</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(i)}
                  className={clsx(
                    'flex h-8.5 w-8.5 items-center justify-center rounded-lg border-[1.5px] text-[13px] font-semibold transition-colors',
                    i === page ? 'border-admin-blue bg-admin-blue text-white' : 'border-admin-border text-admin-text-sec hover:border-admin-blue hover:text-admin-blue'
                  )}
                >
                  {i}
                </button>
              </span>
            ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border-[1.5px] border-admin-border text-admin-text-sec transition-colors hover:border-admin-blue hover:text-admin-blue disabled:opacity-40"
          >
            <IconChevronRight size={16} />
          </button>
          <span className="px-2 text-xs text-admin-text-sec">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.length)} de {list.length}
          </span>
        </div>
      )}
    </>
  );
}
