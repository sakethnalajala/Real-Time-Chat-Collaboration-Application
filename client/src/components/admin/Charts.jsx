import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatNumber } from '../../utils/format.js';

/*
 * Single-series charts in the brand violet (--chart-1, validated per theme).
 * Spec: 2px line + 10% area wash, bars <= 24px with 4px rounded data-ends,
 * hairline solid gridlines, recessive axes, crosshair tooltip on the area chart,
 * per-bar tooltip on the column chart. Text always uses text tokens, never the series colour.
 */

const AXIS_TICK = { fill: 'var(--app-subtle)', fontSize: 11 };
const shortDate = (value) => format(parseISO(value), 'MMM d');

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-xl border border-line bg-elevated px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-fg tabular-nums">
        {formatNumber(value)} {value === 1 ? unit.one : unit.many}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-0.5 w-3 rounded-full" style={{ background: 'var(--chart-1)' }} />
        {format(parseISO(label), 'EEEE, MMM d')}
      </p>
    </div>
  );
}

export function AreaTrend({ data, unit = { one: 'message', many: 'messages' }, height = 240 }) {
  return (
    <div style={{ height }} role="img" aria-label={`Daily ${unit.many} over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="trend-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--app-line)" strokeWidth={1} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={formatNumber} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: 'var(--app-line-strong)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="url(#trend-wash)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--app-surface)', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ColumnTrend({ data, unit = { one: 'sign-up', many: 'sign-ups' }, height = 240 }) {
  return (
    <div style={{ height }} role="img" aria-label={`Daily ${unit.many} over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--app-line)" strokeWidth={1} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={formatNumber} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'var(--app-surface-2)', opacity: 0.6 }} />
          <Bar
            dataKey="count"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            activeBar={{ fill: 'var(--chart-1)', fillOpacity: 0.78 }}
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole as labelled proportion bars (labels carry identity, one hue). */
export function ProportionList({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const pct = total ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-medium text-fg">
                {item.icon && <item.icon className="h-4 w-4 text-muted" />}
                {item.label}
              </span>
              <span className="tabular-nums text-muted">
                <span className="font-semibold text-fg">{formatNumber(item.value)}</span> · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-500/12" title={`${item.label}: ${formatNumber(item.value)} (${pct}%)`}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: 'var(--chart-1)' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
