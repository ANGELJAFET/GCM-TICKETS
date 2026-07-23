import Image from 'next/image';
import { IconBeach, IconPlus, IconClockBolt, IconShieldCheck, IconEye } from '@tabler/icons-react';

/** Banner de bienvenida del portal con el botón principal "Nuevo ticket"; las olas SVG del fondo son puramente decorativas. */
export function Hero({ onNuevoTicket }: { onNuevoTicket: () => void }) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl bg-linear-to-br from-portal-navy-dark via-portal-navy to-portal-navy-mid px-9 pt-9 text-white shadow-[0_20px_60px_rgba(26,46,107,0.42),0_4px_16px_rgba(26,46,107,0.22)] max-[768px]:px-7 max-[600px]:rounded-[20px] max-[600px]:px-5.5">
      <div className="pointer-events-none absolute -top-25 -right-25 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(204,34,34,0.22)_0%,transparent_65%)]" />

      <div className="relative z-1 mb-6.5 flex items-center gap-5.5 max-[600px]:flex-wrap">
        <div className="flex h-18.5 w-18.5 shrink-0 items-center justify-center rounded-[20px] border border-white/28 bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_20px_rgba(0,0,0,0.14)] backdrop-blur-sm max-[600px]:h-14 max-[600px]:w-14">
          <Image
            src="/assets/gcm.jpg"
            alt="GCM Grupo Milcien"
            width={54}
            height={54}
            className="h-13.5 w-13.5 rounded-full border-2 border-white/50 bg-white object-contain p-1.25 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[1.2px] text-white/65 uppercase">
            <IconBeach size={14} /> Soporte Técnico Interno
          </div>
          <h2 className="mb-2 text-[22px] leading-tight font-extrabold tracking-tight max-[600px]:text-base">
            Grupo Milcien S.A. de C.V.
          </h2>
          <p className="text-[13.5px] leading-relaxed opacity-80 max-[480px]:hidden">
            El equipo de TI está contigo. Reporta cualquier incidencia y te atenderemos a la brevedad.
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevoTicket}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.25 text-sm font-extrabold whitespace-nowrap text-portal-navy shadow-[0_8px_28px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.28)] max-[600px]:ml-0 max-[600px]:w-full max-[600px]:justify-center"
        >
          <IconPlus size={18} /> Nuevo ticket
        </button>
      </div>

      <div className="relative z-1 flex flex-wrap gap-2.5 border-t border-white/10 pt-4.5 pb-28.5 max-[600px]:pb-27 max-[480px]:gap-1.5 max-[480px]:pb-21">
        <div className="flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm max-[480px]:px-2.5 max-[480px]:text-[10px]">
          <IconClockBolt size={14} /> <span>Respuesta rápida</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm max-[480px]:px-2.5 max-[480px]:text-[10px]">
          <IconShieldCheck size={14} /> <span>Soporte certificado</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm max-[480px]:px-2.5 max-[480px]:text-[10px]">
          <IconEye size={14} /> <span>Seguimiento en vivo</span>
        </div>
      </div>

      <div className="hero-waves" aria-hidden="true">
        <div className="wt wt5">
          <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
            <path fill="rgba(26,60,120,0.28)" d="M0,80 C360,68 720,90 1080,84 C1260,80 1400,76 1440,80 C1800,68 2160,90 2520,84 C2700,80 2840,76 2880,80 L2880,100 L0,100 Z" />
          </svg>
        </div>
        <div className="wt wt4">
          <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
            <path fill="rgba(200,235,255,0.07)" d="M0,76 C90,58 180,88 360,82 C540,76 630,62 720,76 C810,92 900,90 1080,84 C1260,78 1350,64 1440,76 C1530,58 1620,88 1800,82 C1980,76 2070,62 2160,76 C2250,92 2340,90 2520,84 C2700,78 2790,64 2880,76 L2880,100 L0,100 Z" />
          </svg>
        </div>
        <div className="wt wt3">
          <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
            <path fill="rgba(255,255,255,0.07)" d="M0,64 C260,30 500,88 740,72 C980,56 1220,26 1440,64 C1700,30 1940,88 2180,72 C2420,56 2660,26 2880,64 L2880,100 L0,100 Z" />
          </svg>
        </div>
        <div className="wt wt2">
          <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
            <path fill="rgba(180,220,255,0.09)" d="M0,58 C200,80 360,90 580,82 C800,72 960,20 1140,20 C1320,20 1400,44 1440,58 C1640,80 1800,90 2020,82 C2240,72 2400,20 2580,20 C2760,20 2840,44 2880,58 L2880,100 L0,100 Z" />
          </svg>
        </div>
        <div className="wt wt1">
          <svg viewBox="0 0 2880 100" preserveAspectRatio="none">
            <path fill="rgba(255,255,255,0.14)" d="M0,50 C100,50 280,10 420,10 C560,10 660,46 860,75 C1060,95 1180,86 1220,83 C1260,80 1390,56 1440,50 C1540,50 1720,10 1860,10 C2000,10 2100,46 2300,75 C2500,95 2620,86 2660,83 C2700,80 2830,56 2880,50 L2880,100 L0,100 Z" />
            <path fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.8" strokeLinecap="round" d="M0,50 C100,50 280,10 420,10 C560,10 660,46 860,75 C1060,95 1180,86 1220,83 C1260,80 1390,56 1440,50 C1540,50 1720,10 1860,10 C2000,10 2100,46 2300,75 C2500,95 2620,86 2660,83 C2700,80 2830,56 2880,50" />
          </svg>
        </div>
      </div>
    </div>
  );
}
