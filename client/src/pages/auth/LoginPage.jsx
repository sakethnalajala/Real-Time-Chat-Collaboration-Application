import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Info, KeyRound, LogIn, Mail, MousePointerClick, RefreshCw, ServerCrash, ShieldCheck, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button.jsx';
import { Input, PasswordInput } from '../../components/ui/Input.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { Badge, Skeleton } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { getErrorMessage } from '../../services/api.js';
import { ENABLE_DEMO_LOGIN } from '../../config/env.js';
import { loginSchema } from '../../utils/validators.js';
import { firstName } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';
import AuthCard from './AuthCard.jsx';

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Copy is not available in this browser');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md p-1 text-subtle transition hover:bg-surface hover:text-fg"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CredentialRow({ icon: Icon, label, value, mono, copyable }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line/70 bg-surface/60 py-1.5 pr-1 pl-2.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-semibold tracking-wider text-subtle uppercase">{label}</dt>
        <dd className={cn('truncate text-xs text-fg', mono && 'font-mono tracking-tight')} title={value}>
          {value}
        </dd>
      </div>
      {copyable && <CopyButton value={value} label={label.toLowerCase()} />}
    </div>
  );
}

// The sign-in page offers one demo account per role. Sign-in goes through POST /auth/demo-login,
// so passwords never reach the browser.
const DEMO_SLOTS = [
  { role: 'user', title: 'Demo User' },
  { role: 'admin', title: 'Demo Admin' },
];

const pickDemoAccounts = (accounts = []) =>
  DEMO_SLOTS.flatMap(({ role, title }) => {
    const account = accounts.find((a) => a.role === role);
    return account ? [{ ...account, title }] : [];
  });

function DemoAccountCard({ account, index, onUse, loading, disabled }) {
  const isAdmin = account.role === 'admin';
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-shadow duration-300 hover:shadow-xl',
        isAdmin
          ? 'border-brand-500/40 bg-linear-to-br from-brand-500/14 via-surface/70 to-fuchsia-500/8 hover:shadow-brand-700/25'
          : 'border-line bg-surface/70 hover:border-brand-500/30 hover:shadow-brand-900/15'
      )}
      aria-label={account.title}
    >
      <span
        className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full bg-brand-500/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <header className="relative flex items-center gap-3">
        <Avatar name={account.fullName} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg">{account.title}</h3>
          <p className="truncate text-xs text-muted">{account.fullName}</p>
        </div>
        <Badge tone={isAdmin ? 'brand' : 'neutral'}>
          {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
          {isAdmin ? 'Admin' : 'User'}
        </Badge>
      </header>

      <dl className="relative mt-3 space-y-1.5">
        <div className="flex items-center gap-2 px-0.5 text-[11px] text-muted">
          <span className="font-semibold text-subtle uppercase">Role</span>
          <span className="text-fg">{isAdmin ? 'Administrator' : 'Standard user'}</span>
        </div>
        <CredentialRow icon={Mail} label="Email" value={account.email} copyable />
        <CredentialRow icon={KeyRound} label="Sign-in" value="One click — no password needed" />
      </dl>

      <Button size="sm" className="relative mt-3" leftIcon={MousePointerClick} onClick={() => onUse(account)} loading={loading} disabled={disabled}>
        Use Demo Account
      </Button>
    </motion.article>
  );
}

function DemoNotice({ icon: Icon, tone, title, children, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-6 text-center"
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-2xl border',
          tone === 'danger' ? 'border-rose-500/25 bg-rose-500/10 text-rose-500' : 'border-brand-500/25 bg-brand-500/10 text-brand-400'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">{children}</p>
      </div>
      {action}
    </motion.div>
  );
}

/** status: 'loading' | 'ready' | 'error' | 'unavailable' */
function DemoAccountsSection({ status, accounts, onRetry, onUse, loadingKey, disabled }) {
  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface/60 p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6 dark:shadow-black/30" aria-labelledby="demo-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="demo-heading" className="flex items-center gap-2 text-base font-semibold text-fg">
            <Sparkles className="h-4 w-4 text-brand-400" /> Demo Accounts
          </h2>
          <p className="mt-0.5 text-xs text-muted">Real accounts on this server. Sign in with one click — no password needed.</p>
        </div>
        <Badge tone="brand">One-click sign-in</Badge>
      </div>

      {status === 'loading' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading demo accounts">
            {DEMO_SLOTS.map((slot) => (
              <Skeleton key={slot.role} className="h-52 rounded-2xl" />
            ))}
          </div>
          {/* Free hosting sleeps when idle; the first request can take up to a minute. */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 4 }}
            className="mt-3 text-center text-xs text-muted"
            role="status"
          >
            Waking up the server — this can take up to a minute on the first visit.
          </motion.p>
        </>
      )}

      {status === 'ready' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account, index) => (
            <DemoAccountCard
              key={account.key}
              account={account}
              index={index}
              onUse={onUse}
              loading={loadingKey === account.key}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {status === 'error' && (
        <DemoNotice
          icon={ServerCrash}
          tone="danger"
          title="Couldn't load the demo accounts"
          action={
            <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={onRetry}>
              Try again
            </Button>
          }
        >
          The server didn't respond. It may still be starting up — try again in a moment.
        </DemoNotice>
      )}

      {status === 'unavailable' && (
        <DemoNotice icon={Info} title="Demo sign-in is turned off on this server">
          Sign in with your account above, or create one in a few seconds.
        </DemoNotice>
      )}

      <p className="mt-4 text-center text-[11px] text-subtle">
        Tip: sign in as Demo User in one browser and Demo Admin in another (or a private window) to watch messages, typing and read receipts
        update live.
      </p>
    </section>
  );
}

export default function LoginPage() {
  useDocumentTitle('Sign in · Nebula Chat');
  const { login, demoLogin } = useAuth();
  const { config, isLoading: configLoading, isFetching: configFetching, isError: configError, refetch: refetchConfig } = useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [demoLoading, setDemoLoading] = useState(null);
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${firstName(user.fullName)}!`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Unable to sign in') });
    }
  };

  const signInWithDemo = async (account) => {
    setDemoLoading(account.key);
    try {
      const user = await demoLogin(account.key);
      toast.success(`Signed in as ${user.fullName}`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Demo sign-in failed'));
    } finally {
      setDemoLoading(null);
    }
  };

  const demoAccounts = config.demo?.enabled ? pickDemoAccounts(config.demo.accounts) : [];
  const demoStatus = demoAccounts.length
    ? 'ready'
    : configLoading || configFetching
      ? 'loading'
      : configError
        ? 'error'
        : 'unavailable';

  return (
    <>
      <AuthCard
        title="Welcome back"
        subtitle="Sign in to continue your conversations."
        footer={
          <>
            New here?{' '}
            <Link to="/register" className="font-semibold text-accent-fg hover:underline">
              Create an account
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            icon={Mail}
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            labelRight={
              <Link to="/forgot-password" className="text-xs font-semibold text-accent-fg hover:underline">
                Forgot password?
              </Link>
            }
            {...register('password')}
          />
          <AnimatePresence>
            {errors.root && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500"
              >
                {errors.root.message}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} leftIcon={LogIn}>
            Sign in
          </Button>
        </form>
      </AuthCard>

      {ENABLE_DEMO_LOGIN && (
        <DemoAccountsSection
          status={demoStatus}
          accounts={demoAccounts}
          onRetry={() => refetchConfig()}
          onUse={signInWithDemo}
          loadingKey={demoLoading}
          disabled={Boolean(demoLoading) || isSubmitting}
        />
      )}
    </>
  );
}
