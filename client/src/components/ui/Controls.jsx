import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import Button from './Button.jsx';

export function Switch({ checked, onChange, disabled, label, description, id }) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-fg">{label}</span>}
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
        </span>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          checked ? 'border-brand-500 bg-brand-600' : 'border-line-strong bg-surface-2'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={cn('h-4.5 w-4.5 rounded-full bg-white shadow-md', checked ? 'ml-[22px]' : 'ml-[3px]')}
        />
      </button>
    </label>
  );
}

/** Segmented control with an animated active pill. */
export function Tabs({ tabs, value, onChange, layoutId = 'tabs', className, size = 'md' }) {
  return (
    <div role="tablist" className={cn('inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg border border-line bg-elevated shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
              {tab.label}
              {tab.count ? (
                <span className="rounded-full bg-brand-500/15 px-1.5 text-[10px] font-bold text-accent-fg">{tab.count}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ pagination, onPageChange, className }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <div className={cn('flex items-center justify-between gap-3 pt-4', className)}>
      <p className="text-xs text-muted">
        Page <span className="font-semibold text-fg">{page}</span> of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" leftIcon={ChevronLeft} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <Button variant="secondary" size="sm" rightIcon={ChevronRight} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface/80 shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action, icon: Icon }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-400">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
