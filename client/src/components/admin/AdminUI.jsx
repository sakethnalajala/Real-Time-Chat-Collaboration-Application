import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Table2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { formatNumber } from '../../utils/format.js';
import { Card } from '../ui/Controls.jsx';
import { Badge } from '../ui/Feedback.jsx';

export const REPORT_REASONS = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  inappropriate_content: 'Inappropriate content',
  impersonation: 'Impersonation',
  other: 'Other',
};

export const REPORT_STATUS = {
  open: { label: 'Open', tone: 'danger' },
  reviewing: { label: 'Reviewing', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

export const REPORT_ACTIONS = {
  none: 'No action',
  warned: 'User warned',
  message_removed: 'Message removed',
  user_suspended: 'User suspended',
};

export const ReportStatusBadge = ({ status }) => (
  <Badge tone={REPORT_STATUS[status]?.tone ?? 'neutral'} dot>
    {REPORT_STATUS[status]?.label ?? status}
  </Badge>
);

export const UserStatusBadge = ({ status }) =>
  status === 'suspended' ? (
    <Badge tone="danger" dot>
      Suspended
    </Badge>
  ) : (
    <Badge tone="success" dot>
      Active
    </Badge>
  );

export const RoleBadge = ({ role }) => (role === 'admin' ? <Badge tone="brand">Admin</Badge> : <Badge>User</Badge>);

/** Stat tile: label · value · optional hint. */
export function StatTile({ icon: Icon, label, value, hint, to, live }) {
  const body = (
    <Card className="h-full p-4 transition hover:border-brand-500/30 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-400">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-fg">
        {formatNumber(value)}
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-label="Live" />}
      </p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </Card>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Chart card with a "view as table" toggle so values never depend on hovering. */
export function ChartCard({ title, description, headline, table, children, className }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {headline}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                showTable ? 'border-brand-500/40 bg-brand-500/10 text-fg' : 'border-line text-muted hover:text-fg'
              )}
              aria-pressed={showTable}
            >
              <Table2 className="h-3.5 w-3.5" /> Table
            </button>
          )}
        </div>
      </div>
      <div className="mt-4">
        {showTable && table ? (
          <div className="max-h-[260px] overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {row.map((cell, j) => (
                      <td key={j} className={cn('px-3 py-1.5', j > 0 ? 'text-fg' : 'text-muted')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/** Native select styled to match inputs (accessible and mobile friendly). */
export function Select({ value, onChange, options, label, className }) {
  return (
    <label className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-surface-2/70 pr-9 pl-3 text-sm text-fg transition outline-none hover:border-line-strong focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-subtle" />
    </label>
  );
}

/** Responsive table shell: horizontal scroll on narrow screens, hover rows. */
export function DataTable({ columns, rows, onRowClick, rowKey = (row) => row._id, empty }) {
  if (!rows.length) return empty ?? null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-surface-2/70 text-left text-xs font-semibold tracking-wide text-subtle uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn('px-4 py-3', column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn('border-t border-line bg-surface/40 transition', onRowClick && 'cursor-pointer hover:bg-brand-500/[0.04] focus:bg-brand-500/[0.06] focus:outline-none')}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle', column.cellClassName)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
