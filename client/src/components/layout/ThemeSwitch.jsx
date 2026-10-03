import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { cn } from '../../utils/cn.js';

/**
 * Animated dark/light switch: the knob slides with a spring, the icon spins in,
 * and the track shows stars (dark) or soft clouds (light).
 * `onToggle(nextTheme)` lets signed-in pages persist the choice to the account.
 */
export default function ThemeSwitch({ className, onToggle }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={label}
      onClick={() => {
        toggleTheme();
        onToggle?.(dark ? 'light' : 'dark');
      }}
      className={cn(
        'group relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-full border p-[3px] transition-[background-color,border-color,box-shadow] duration-300 hover:shadow-lg',
        dark
          ? 'border-brand-500/35 bg-[#130e22] hover:shadow-brand-700/30'
          : 'border-amber-300/70 bg-linear-to-r from-sky-100 to-amber-50 hover:shadow-amber-300/40',
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden>
        <AnimatePresence initial={false}>
          {dark ? (
            <motion.span key="stars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="absolute top-[9px] left-[9px] h-[3px] w-[3px] animate-pulse rounded-full bg-white/90" />
              <span className="absolute top-[18px] left-[17px] h-[2px] w-[2px] rounded-full bg-white/70" />
              <span className="absolute top-[7px] left-[22px] h-[2px] w-[2px] animate-pulse rounded-full bg-brand-200" style={{ animationDelay: '0.6s' }} />
            </motion.span>
          ) : (
            <motion.span key="clouds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="absolute top-[9px] right-[9px] h-[7px] w-[14px] rounded-full bg-white" />
              <span className="absolute top-[16px] right-[16px] h-[6px] w-[11px] rounded-full bg-white/80" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <motion.span
        animate={{ x: dark ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        className={cn(
          'relative z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md',
          dark ? 'bg-linear-to-br from-brand-400 to-brand-700 shadow-brand-700/60' : 'bg-white shadow-amber-400/40'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -120, scale: 0.3, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 120, scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="flex"
          >
            {dark ? <Moon className="h-3.5 w-3.5 text-white" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
