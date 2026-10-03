import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

const VARIANTS = {
  primary:
    'brand-gradient text-white shadow-lg shadow-brand-700/25 hover:shadow-brand-600/40 hover:brightness-110 disabled:shadow-none',
  secondary: 'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-elevated',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  outline: 'border border-line text-fg hover:bg-surface-2 hover:border-line-strong',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-900/20',
  'danger-ghost': 'text-rose-500 hover:bg-rose-500/10',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3 text-sm gap-2 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export default function Button({
  as: Component,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  children,
  type = 'button',
  ...props
}) {
  const classes = cn(
    'relative inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    className
  );

  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : LeftIcon ? <LeftIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
      {children}
      {RightIcon && !loading ? <RightIcon className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  );

  if (Component) {
    return (
      <Component className={classes} {...props}>
        {content}
      </Component>
    );
  }

  return (
    <motion.button
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </motion.button>
  );
}

export function IconButton({ icon: Icon, label, className, size = 'icon', variant = 'ghost', active, badge, ...props }) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn(active && 'bg-surface-2 text-fg', className)}
      {...props}
    >
      <Icon className={size === 'icon-sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </Button>
  );
}
