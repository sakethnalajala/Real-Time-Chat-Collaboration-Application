import { cn } from '../../utils/cn.js';

export default function AuthCard({ title, subtitle, children, footer, className }) {
  return (
    <div className={cn('rounded-3xl border border-line bg-surface/80 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-8 dark:shadow-black/40', className)}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
