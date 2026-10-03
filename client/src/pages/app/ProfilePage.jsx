import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  AtSign,
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Flag,
  Gauge,
  History,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Save,
  ScrollText,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import AmbientBackground from '../../components/ui/AmbientBackground.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, PasswordInput, Textarea } from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { adminService, authService, userService } from '../../services/index.js';
import { getErrorMessage, getFieldErrors, tokenStore } from '../../services/api.js';
import { changePasswordSchema, profileSchema } from '../../utils/validators.js';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '../../utils/format.js';
import { cn } from '../../utils/cn.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const EASE = [0.22, 1, 0.36, 1];

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: EASE, delay },
});

const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Glassy section card used across the profile page. */
function Panel({ id, icon: Icon, title, description, action, children, className, delay = 0 }) {
  return (
    <motion.section
      id={id}
      {...rise(delay)}
      className={cn(
        'scroll-mt-6 rounded-3xl border border-line bg-surface/70 p-5 shadow-xl shadow-black/5 backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-brand-500/25 hover:shadow-brand-900/10 sm:p-6',
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-500/20 to-fuchsia-500/10 text-brand-400 ring-1 ring-brand-500/20">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function AdminBadge() {
  return (
    <span className="relative inline-flex items-center gap-1 overflow-hidden rounded-full bg-linear-to-r from-brand-600 to-fuchsia-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-lg shadow-brand-700/40">
      <ShieldCheck className="h-3.5 w-3.5" /> Admin
      <span aria-hidden className="absolute inset-0 -translate-x-full animate-shine bg-linear-to-r from-transparent via-white/45 to-transparent" />
    </span>
  );
}

function ProfileHero({ online }) {
  const { user, updateUser, isAdmin } = useAuth();
  const { config } = useAppConfig();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const maxMB = config.uploads?.maxAvatarSizeMB ?? 5;

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error('Please choose a JPG, PNG, WebP or GIF image');
    if (file.size > maxMB * 1024 * 1024) return toast.error(`Profile pictures must be ${maxMB} MB or smaller`);
    setBusy(true);
    try {
      const { user: updated } = await userService.updateAvatar(file);
      updateUser(updated);
      toast.success('Profile picture updated');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    try {
      const { user: updated } = await userService.removeAvatar();
      updateUser(updated);
      toast.success('Profile picture removed');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const facts = [
    { icon: isAdmin ? ShieldCheck : User, label: 'Role', value: isAdmin ? 'Administrator' : 'Member' },
    { icon: CalendarDays, label: 'Member since', value: formatDate(user.createdAt, 'MMM yyyy') },
    { icon: online ? Wifi : Clock3, label: 'Last seen', value: online ? 'Online now' : formatRelative(user.lastSeen) },
    { icon: BadgeCheck, label: 'Account', value: user.status === 'active' ? 'Active' : 'Restricted' },
  ];

  return (
    <motion.section {...rise(0)} className="relative overflow-hidden rounded-[2rem] border border-line bg-surface/70 shadow-2xl shadow-brand-950/10 backdrop-blur-xl">
      <div className="relative h-40 overflow-hidden sm:h-48">
        <div className="absolute inset-0 animate-gradient-pan bg-[linear-gradient(115deg,#1e0b3d,#5b21b6,#7c3aed,#a21caf,#3b0f6e,#1e0b3d)] bg-[length:300%_300%]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_120%,rgba(255,255,255,0.22),transparent_42%),radial-gradient(circle_at_85%_-20%,rgba(244,114,182,0.35),transparent_40%)]" />
        <AmbientBackground particles={10} className="opacity-80" />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {user.isDemo && <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">Demo account</span>}
          <span className="flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-400' : 'bg-zinc-400')} />
            {online ? 'Online' : 'Connecting'}
          </span>
        </div>
      </div>

      <div className="relative px-5 pb-6 sm:px-8">
        <div className="-mt-16 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="relative shrink-0">
            <span aria-hidden className="absolute -inset-1.5 animate-spin-slow rounded-full bg-[conic-gradient(from_0deg,#a78bfa,#7c3aed,#d946ef,#6366f1,#a78bfa)] opacity-90 blur-[2px]" />
            <span aria-hidden className="absolute -inset-4 animate-glow rounded-full bg-brand-500/30 blur-2xl" />
            <Avatar src={user.avatarUrl} name={user.fullName} size="3xl" online={online} className="relative rounded-full ring-4 ring-surface" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !config.uploads?.enabled}
              className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full brand-gradient text-white shadow-lg ring-4 ring-surface transition hover:scale-110 disabled:opacity-50"
              aria-label="Change profile picture"
              title={config.uploads?.enabled ? 'Change profile picture' : 'Image uploads are not configured on this server'}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={upload} />
          </div>

          <div className="min-w-0 flex-1 sm:pt-[4.75rem]">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{user.fullName}</h1>
              {isAdmin && <AdminBadge />}
            </div>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted sm:justify-start">
              <span className="flex items-center gap-1">
                <AtSign className="h-3.5 w-3.5" />
                {user.username}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </span>
            </p>
            <p className={cn('mt-3 max-w-2xl text-sm leading-relaxed', user.bio ? 'text-fg/85' : 'text-subtle italic')}>
              {user.bio || 'No bio yet — tell people a little about yourself.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 sm:pt-[4.75rem]">
            <Button size="sm" leftIcon={Pencil} onClick={() => scrollToId('edit-profile')}>
              Edit profile
            </Button>
            <Button size="sm" variant="secondary" leftIcon={KeyRound} onClick={() => scrollToId('change-password')}>
              Password
            </Button>
            {user.avatarUrl && (
              <Button size="sm" variant="danger-ghost" leftIcon={Trash2} onClick={removeAvatar} disabled={busy} aria-label="Remove profile picture">
                Photo
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facts.map((fact, index) => (
            <motion.div
              key={fact.label}
              {...rise(0.15 + index * 0.05)}
              whileHover={{ y: -3 }}
              className="rounded-2xl border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-brand-500/30"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                <fact.icon className="h-3.5 w-3.5 text-brand-400" /> {fact.label}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-fg">{fact.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{label}</p>
        <p className="truncate text-sm text-fg" title={typeof value === 'string' ? value : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}

function AccountOverview({ online }) {
  const { user, isAdmin } = useAuth();
  return (
    <Panel icon={User} title="Account overview" description="Your details at a glance." delay={0.1}>
      <div className="divide-y divide-line/70">
        <InfoRow icon={Mail} label="Email" value={user.email} />
        <InfoRow icon={AtSign} label="Username" value={`@${user.username}`} />
        <InfoRow icon={isAdmin ? ShieldCheck : User} label="Role" value={isAdmin ? 'Administrator' : 'Member'} />
        <InfoRow icon={BadgeCheck} label="Account type" value={user.isDemo ? 'Shared demo account' : 'Personal account'} />
        <InfoRow icon={CalendarDays} label="Member since" value={formatDateTime(user.createdAt)} />
        <InfoRow icon={Clock3} label="Last seen" value={online ? 'Online now' : formatDateTime(user.lastSeen)} />
      </div>
    </Panel>
  );
}

function SecurityPanel() {
  const { user, endSession } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const protections = [
    { icon: Lock, text: 'Password stored as a bcrypt hash' },
    { icon: KeyRound, text: 'Rotating httpOnly session cookies' },
    { icon: Fingerprint, text: 'Role-based access on every request' },
    { icon: ShieldCheck, text: 'Rate-limited sign-in attempts' },
  ];

  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      await authService.logoutAll();
      endSession();
      toast.success('Signed out of all devices');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <Panel icon={ShieldCheck} title="Security" description="How your account is protected." delay={0.15}>
      <ul className="space-y-2.5">
        {protections.map((item) => (
          <li key={item.text} className="flex items-center gap-2.5 text-sm text-fg">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            {item.text}
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-2xl border border-line bg-surface-2/50 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-subtle uppercase">
          <History className="h-3.5 w-3.5 text-brand-400" /> Password last changed
        </p>
        <p className="mt-1 text-sm font-medium text-fg">{user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : 'Not changed since sign-up'}</p>
      </div>
      <Button variant="danger-ghost" size="sm" leftIcon={LogOut} className="mt-4 w-full justify-center" onClick={() => setConfirm(true)}>
        Sign out of all devices
      </Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={signOutEverywhere}
        loading={busy}
        title="Sign out of all devices?"
        description="Every active session ends immediately, including this one."
        confirmLabel="Sign out everywhere"
      />
    </Panel>
  );
}

function AdminConsole() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminService.stats, staleTime: 30_000 });
  const totals = data?.totals;
  const stats = [
    { icon: Users, label: 'Total users', value: totals?.users },
    { icon: Activity, label: 'Online now', value: totals?.onlineNow },
    { icon: MessageSquare, label: 'Messages today', value: totals?.messagesToday },
    { icon: Flag, label: 'Open reports', value: totals?.openReports },
  ];
  const links = [
    { to: '/admin', icon: Gauge, label: 'Admin overview' },
    { to: '/admin/users', icon: UserCog, label: 'Manage users' },
    { to: '/admin/reports', icon: Flag, label: 'Review reports' },
    { to: '/admin/audit', icon: ScrollText, label: 'Audit log' },
  ];

  return (
    <motion.section
      {...rise(0.05)}
      className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-linear-to-br from-brand-500/15 via-surface/75 to-fuchsia-500/10 p-5 shadow-xl shadow-brand-900/15 backdrop-blur-xl sm:p-6"
    >
      <span aria-hidden className="absolute -top-16 -right-16 h-48 w-48 animate-glow rounded-full bg-brand-500/25 blur-3xl" />
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient text-white shadow-lg shadow-brand-700/40">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-fg">Administrator console</h2>
            <p className="text-sm text-muted">Live platform snapshot and quick access to admin tools.</p>
          </div>
        </div>
        <Button as={Link} to="/admin" size="sm" rightIcon={ArrowRight}>
          Open admin
        </Button>
      </header>

      <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface/70 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
              <stat.icon className="h-3.5 w-3.5 text-brand-400" /> {stat.label}
            </p>
            {isLoading ? <Skeleton className="mt-2 h-6 w-12" /> : <p className="mt-1 text-2xl font-semibold text-fg">{formatNumber(stat.value ?? 0)}</p>}
          </div>
        ))}
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-sm font-medium text-fg transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-900/10"
          >
            <link.icon className="h-4 w-4 text-brand-400" />
            <span className="flex-1">{link.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
          </Link>
        ))}
      </div>
    </motion.section>
  );
}

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, username: user.username, bio: user.bio || '' },
  });

  useEffect(() => {
    reset({ fullName: user.fullName, username: user.username, bio: user.bio || '' });
  }, [user.fullName, user.username, user.bio, reset]);

  const onSubmit = async (values) => {
    try {
      const { user: updated } = await userService.updateMe({ ...values, username: values.username.toLowerCase() });
      updateUser(updated);
      reset({ fullName: updated.fullName, username: updated.username, bio: updated.bio });
      toast.success('Profile saved');
    } catch (error) {
      const fields = getFieldErrors(error);
      Object.entries(fields).forEach(([name, message]) => setError(name, { message }));
      toast.error(getErrorMessage(error, 'Could not save your profile'));
    }
  };

  return (
    <Panel id="edit-profile" icon={Pencil} title="Edit profile" description="This is how others see you across the app." delay={0.1}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" icon={User} error={errors.fullName?.message} {...register('fullName')} />
          <Input
            label="Username"
            icon={AtSign}
            error={errors.username?.message}
            disabled={user.isDemo}
            hint={user.isDemo ? 'Demo accounts keep their username' : undefined}
            {...register('username')}
          />
        </div>
        <Input label="Email" icon={Mail} value={user.email} disabled readOnly hint="Your email is used to sign in and can't be changed here." />
        <Textarea label="Bio" placeholder="Tell people a little about yourself" maxLength={160} value={watch('bio')} error={errors.bio?.message} {...register('bio')} />
        <div className="flex justify-end">
          <Button type="submit" leftIcon={Save} loading={isSubmitting} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PasswordForm() {
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    try {
      const result = await authService.changePassword(values);
      tokenStore.set(result.accessToken);
      reset();
      toast.success('Password changed. Other devices were signed out.');
    } catch (error) {
      const fields = getFieldErrors(error);
      Object.entries(fields).forEach(([name, message]) => setError(name, { message }));
      if (!Object.keys(fields).length) toast.error(getErrorMessage(error, 'Could not change your password'));
    }
  };

  return (
    <Panel
      id="change-password"
      icon={KeyRound}
      title="Change password"
      description="At least 8 characters with upper & lowercase letters and a number."
      delay={0.15}
    >
      {user.isDemo ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
          Demo accounts are shared, so their password can't be changed. Create your own account to try this feature.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <PasswordInput label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              showStrength
              value={watch('newPassword')}
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" leftIcon={KeyRound} loading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

export default function ProfilePage() {
  useDocumentTitle('Your profile · Nebula Chat');
  const { isAdmin } = useAuth();
  const { status } = useSocket();
  const online = status === 'connected';

  return (
    <div className="relative h-full">
      <AmbientBackground particles={16} />
      <PageContainer wide className="relative">
        <ProfileHero online={online} />
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-1">
            <AccountOverview online={online} />
            <SecurityPanel />
          </div>
          <div className="space-y-5 lg:col-span-2">
            {isAdmin && <AdminConsole />}
            <ProfileForm />
            <PasswordForm />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
