import { cn } from '../../utils/cn.js';

// Deterministic positions so the layout never shifts between renders.
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 23) % 100,
  size: 2 + (i % 3),
  delay: (i % 9) * 1.4,
  duration: 10 + (i % 5) * 2.5,
}));

/**
 * Soft, slow-moving glow orbs and drifting particles in the brand colours.
 * No grid lines or boxes — just light. Pointer-events are disabled so it never blocks UI,
 * and the global reduced-motion rule freezes it for users who prefer less motion.
 */
export default function AmbientBackground({ className, particles = 14, intensity = 'normal' }) {
  const strong = intensity === 'strong';
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,var(--app-glow),transparent_70%)]" />
      <div className={cn('absolute -top-40 -left-32 h-[32rem] w-[32rem] animate-float rounded-full blur-3xl', strong ? 'bg-brand-600/35' : 'bg-brand-600/22')} />
      <div
        className={cn('absolute top-1/4 -right-40 h-[36rem] w-[36rem] animate-float-slow rounded-full blur-3xl', strong ? 'bg-fuchsia-600/22' : 'bg-fuchsia-600/12')}
      />
      <div className={cn('absolute -bottom-52 left-1/3 h-[32rem] w-[32rem] animate-float rounded-full blur-3xl', strong ? 'bg-indigo-600/28' : 'bg-indigo-600/16')} style={{ animationDelay: '-6s' }} />
      {PARTICLES.slice(0, particles).map((p, i) => (
        <span
          key={i}
          className="absolute animate-drift rounded-full bg-brand-300/70 shadow-[0_0_8px_rgba(167,139,250,0.8)]"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
