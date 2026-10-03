import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { Bell, CheckCheck, FileText, Paperclip, SendHorizontal, ShieldCheck, Smile } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const AVATAR = {
  MC: 'from-orange-400 to-rose-500',
  LC: 'from-sky-500 to-indigo-600',
  AS: 'from-fuchsia-500 to-violet-600',
  PL: 'from-violet-500 to-indigo-700',
};

function Dot({ initials, className }) {
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-[10px] font-bold text-white', AVATAR[initials], className)}>
      {initials}
    </span>
  );
}

const reveal = (delay) => ({
  initial: { opacity: 0, y: 12, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { delay, type: 'spring', stiffness: 260, damping: 22 },
});

/** The product window: a stylised group conversation (always rendered in the dark brand look). */
function ChatWindow() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d0a16]/92 text-left shadow-[0_40px_120px_-30px_rgba(91,33,182,0.75)] backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <Dot initials="PL" className="ml-1 h-8 w-8 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">Product Launch 🚀</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 3 members · 2 online
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 py-4">
        <motion.div {...reveal(0.55)} className="flex items-end gap-2">
          <Dot initials="MC" />
          <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.06] px-3 py-2">
            <p className="text-[10px] font-semibold text-orange-300">Maya Chen</p>
            <p className="text-[12.5px] text-white/90">Landing page copy is ready for review ✍️</p>
          </div>
        </motion.div>

        <motion.div {...reveal(0.75)} className="flex items-end gap-2">
          <Dot initials="LC" />
          <div className="max-w-[75%] rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.06] px-3 py-2">
            <p className="text-[10px] font-semibold text-sky-300">Liam Carter</p>
            <div className="mt-0.5 flex items-center gap-2 rounded-lg bg-white/[0.06] p-1.5 pr-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/20 text-rose-300">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block text-[11.5px] font-medium text-white/90">launch-plan.pdf</span>
                <span className="block text-[10px] text-white/40">2.4 MB</span>
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div {...reveal(0.95)} className="flex justify-end">
          <div className="max-w-[78%] rounded-2xl rounded-br-md bg-linear-to-br from-brand-500 via-brand-600 to-brand-800 px-3 py-2 shadow-lg shadow-brand-900/40">
            <p className="text-[12.5px] text-white">Looks great! Ship it Friday? 🚀</p>
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/70">
              10:42 <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
            </p>
          </div>
        </motion.div>

        <motion.div {...reveal(1.2)} className="flex items-end gap-2">
          <Dot initials="MC" />
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.06] px-3.5 py-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-typing rounded-full bg-white/70" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="pb-1 text-[10px] text-white/40">Maya is typing…</span>
        </motion.div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.07] px-3 py-3">
        <Smile className="h-4 w-4 text-white/40" />
        <Paperclip className="h-4 w-4 text-white/40" />
        <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11.5px] text-white/35">Message Product Launch…</div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-800/50">
          <SendHorizontal className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function FloatingCard({ children, className, style, delay = 0, bobDelay = '0s' }) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 18 }}
      className={cn('absolute z-20', className)}
    >
      <div
        className="animate-bob rounded-2xl border border-white/10 bg-[#15101f]/85 px-3.5 py-2.5 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
        style={{ animationDelay: bobDelay }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/**
 * Animated hero illustration: entrance animation, a breathing glow, an orbiting ring,
 * a gentle float, and pointer-driven 3D parallax (disabled for reduced-motion users).
 */
export default function HeroIllustration() {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 110, damping: 18 });
  const y = useSpring(pointerY, { stiffness: 110, damping: 18 });

  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10]);
  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const nearX = useTransform(x, [-0.5, 0.5], [-22, 22]);
  const nearY = useTransform(y, [-0.5, 0.5], [-16, 16]);
  const farX = useTransform(x, [-0.5, 0.5], [12, -12]);
  const farY = useTransform(y, [-0.5, 0.5], [10, -10]);

  const onPointerMove = (event) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const reset = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      role="img"
      aria-label="Illustration of a Nebula Chat group conversation with a shared file, read receipts, a typing indicator and live notifications"
      className="relative mx-auto aspect-[10/9] w-full max-w-[580px] select-none [perspective:1400px]"
    >
      <div aria-hidden className="absolute inset-[8%] animate-glow rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.55),rgba(217,70,239,0.18)_45%,transparent_70%)] blur-2xl" />
      <div aria-hidden className="absolute inset-[2%] animate-spin-slow rounded-full border border-brand-400/15">
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 rounded-full bg-brand-300" style={{ boxShadow: '0 0 18px 4px rgba(167,139,250,0.8)' }} />
        <span className="absolute bottom-[14%] -left-1 h-2 w-2 rounded-full bg-fuchsia-300" style={{ boxShadow: '0 0 12px 3px rgba(240,171,252,0.7)' }} />
      </div>

      <motion.div
        aria-hidden
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, y: 50, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.25 }}
        className="absolute inset-x-[9%] top-[9%] bottom-[7%]"
      >
        <div className="h-full animate-bob" style={{ animationDuration: '8s' }}>
          <ChatWindow />
        </div>
      </motion.div>

      <div aria-hidden>
        <FloatingCard style={{ x: nearX, y: nearY }} className="top-[3%] -left-[2%] sm:left-[-6%]" delay={1.3} bobDelay="-1s">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-brand-400 to-brand-700">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold">New message</p>
              <p className="text-[10.5px] text-white/55">Maya: “Ship it Friday?” 🚀</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard style={{ x: farX, y: farY }} className="top-[30%] -right-[2%] hidden sm:block sm:right-[-7%]" delay={1.5} bobDelay="-3s">
          <div className="flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-sky-300" />
            <p className="text-[11px] font-semibold">Read by 2 people</p>
          </div>
        </FloatingCard>

        <FloatingCard style={{ x: farX, y: nearY }} className="bottom-[4%] -left-[1%] sm:left-[-5%]" delay={1.7} bobDelay="-2s">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2">
              <Dot initials="AS" className="ring-2 ring-[#15101f]" />
              <Dot initials="MC" className="ring-2 ring-[#15101f]" />
              <Dot initials="LC" className="ring-2 ring-[#15101f]" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 3 online now
              </p>
              <p className="text-[10.5px] text-white/50">Presence updates live</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard style={{ x: nearX, y: farY }} className="right-[2%] bottom-[16%] hidden md:block md:right-[-4%]" delay={1.9} bobDelay="-4s">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <p className="text-[11px] font-semibold">Secure sessions</p>
          </div>
        </FloatingCard>
      </div>
    </div>
  );
}
