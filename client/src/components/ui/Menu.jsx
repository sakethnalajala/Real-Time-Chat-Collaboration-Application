import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useClickOutside } from '../../hooks/useUtils.js';
import { cn } from '../../utils/cn.js';

/**
 * Dropdown menu rendered in a portal with fixed positioning, so it is never clipped by
 * scrolling containers (e.g. the message list). Flips upward near the bottom of the screen.
 *
 * items: [{ label, icon, onClick, danger, disabled, hidden, divider }]
 */
export function Menu({ trigger, items, align = 'end', width = 220, className, onOpenChange }) {
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter((item) => !item.hidden);
  const open = Boolean(position);

  const close = useCallback(() => {
    setPosition(null);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const estimatedHeight = visible.length * 40 + 12;
    const openUp = window.innerHeight - rect.bottom < estimatedHeight + 16 && rect.top > estimatedHeight;
    const next = { top: openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6, openUp, triggerTop: rect.top, triggerBottom: rect.bottom };
    if (align === 'end') next.right = Math.max(8, window.innerWidth - rect.right);
    else next.left = Math.min(rect.left, window.innerWidth - width - 8);
    return next;
  }, [visible.length, align, width]);

  const toggle = (event) => {
    event.stopPropagation();
    if (open) return close();
    setPosition(computePosition());
    onOpenChange?.(true);
  };

  useClickOutside([triggerRef, menuRef], close, open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && close();
    // Follow the trigger while its container scrolls; close once it leaves the viewport.
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      const next = computePosition();
      if (!next || next.triggerBottom < 0 || next.triggerTop > window.innerHeight) close();
      else setPosition(next);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close, computePosition]);

  return (
    <>
      <span ref={triggerRef} onClick={toggle} className={cn('inline-flex', className)}>
        {typeof trigger === 'function' ? trigger({ open }) : trigger}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: position.openUp ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{ position: 'fixed', top: position.top, left: position.left, right: position.right, width }}
              className="z-[70] overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-2xl shadow-black/30"
            >
              {visible.map((item, index) =>
                item.divider ? (
                  <div key={`divider-${index}`} className="my-1 h-px bg-line" />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      item.onClick?.();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                      item.danger ? 'text-rose-500 hover:bg-rose-500/10' : 'text-fg hover:bg-surface-2'
                    )}
                  >
                    {item.icon && <item.icon className={cn('h-4 w-4 shrink-0', item.danger ? '' : 'text-muted')} aria-hidden />}
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
