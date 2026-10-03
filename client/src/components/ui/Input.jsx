import { useId, useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { passwordStrength } from '../../utils/validators.js';

export function Field({ label, htmlFor, error, hint, children, className, labelRight }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || labelRight) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
              {label}
            </label>
          )}
          {labelRight}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-500">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  'w-full rounded-xl border bg-surface-2/70 text-sm text-fg placeholder:text-subtle transition-all duration-200 outline-none focus:bg-surface focus:ring-4 disabled:opacity-60';

export const inputClasses = (error) =>
  cn(inputBase, error ? 'border-rose-500/70 focus:ring-rose-500/15' : 'border-line hover:border-line-strong focus:border-brand-500 focus:ring-brand-500/15');

export function Input({ label, error, hint, icon: Icon, rightElement, className, inputClassName, id, ref, labelRight, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} className={className} labelRight={labelRight}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(inputClasses(error), 'h-11', Icon ? 'pl-10' : 'pl-3.5', rightElement ? 'pr-11' : 'pr-3.5', inputClassName)}
          {...props}
        />
        {rightElement && <div className="absolute top-1/2 right-2 -translate-y-1/2">{rightElement}</div>}
      </div>
    </Field>
  );
}

export function PasswordInput({ showStrength, value, ...props }) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value || '') : 0;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];
  return (
    <div className="space-y-2">
      <Input
        {...props}
        value={value}
        type={visible ? 'text' : 'password'}
        rightElement={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="rounded-lg p-1.5 text-subtle transition hover:bg-surface hover:text-fg"
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      {showStrength && value ? (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < strength ? colors[strength] : 'bg-line')} />
            ))}
          </div>
          <span className="w-14 text-right text-[11px] font-medium text-subtle">{labels[strength]}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Textarea({ label, error, hint, className, id, ref, maxLength, value, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      className={className}
      labelRight={maxLength ? <span className="text-xs text-subtle">{`${value?.length ?? 0}/${maxLength}`}</span> : null}
    >
      <textarea
        ref={ref}
        id={inputId}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={cn(inputClasses(error), 'min-h-24 resize-none px-3.5 py-3 leading-relaxed')}
        {...props}
      />
    </Field>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(inputClasses(false), 'h-10 pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden')}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-subtle hover:bg-surface hover:text-fg"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
