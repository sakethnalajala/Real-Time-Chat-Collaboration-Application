import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, KeyRound, Link2, Mail, MailCheck, Send, ShieldCheck, Terminal } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { authService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { forgotSchema } from '../../utils/validators.js';
import AuthCard from './AuthCard.jsx';

/** How this server handles password resets: 'email' | 'on-screen' (development) | 'admin'. */
function resetMode(email) {
  if (email?.passwordReset) return email.passwordReset;
  if (email?.configured) return 'email';
  return email?.devResetLinks ? 'on-screen' : 'admin';
}

function IconBadge({ icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'border-brand-500/25 bg-brand-500/10 text-brand-400',
    success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
  };
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 flex justify-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${tones[tone]}`}>
        <Icon className="h-7 w-7" />
      </span>
    </motion.div>
  );
}

/** Production without an email service: resets go through an administrator. */
function AdminResetInfo({ minutes }) {
  return (
    <AuthCard title="Reset your password" subtitle="This server doesn't send email, so password resets are handled by an administrator.">
      <IconBadge icon={ShieldCheck} />
      <ol className="space-y-3 text-sm text-muted">
        {[
          'Contact an administrator of this workspace and ask for a password reset link.',
          `They'll send you a secure, single-use link. It expires after ${minutes} minutes.`,
          'Open the link and choose a new password. Your other sessions are signed out for safety.',
        ].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-accent-fg">{index + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 flex items-start gap-2 rounded-2xl border border-line bg-surface-2/60 p-3 text-xs text-muted">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
        Already have a reset link? Open it in this browser to choose your new password.
      </p>
      <Button as={Link} to="/login" variant="secondary" className="mt-6 w-full" leftIcon={ArrowLeft}>
        Back to sign in
      </Button>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password · Nebula Chat');
  const { config, isLoading } = useAppConfig();
  const [result, setResult] = useState(null);
  const mode = resetMode(config.email);
  const minutes = config.email?.resetLinkMinutes ?? 30;

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    try {
      setResult(await authService.forgotPassword(email));
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Unable to create a reset link') });
    }
  };

  if (isLoading) {
    return (
      <AuthCard title="Forgot your password?">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthCard>
    );
  }

  if (mode === 'admin') return <AdminResetInfo minutes={minutes} />;

  if (result) {
    const devPath = result.devResetUrl ? new URL(result.devResetUrl).pathname : null;

    if (mode === 'on-screen') {
      return (
        <AuthCard
          title={devPath ? 'Your reset link is ready' : 'Request received'}
          subtitle={devPath ? 'Choose a new password using the secure link below.' : `If an account exists for ${getValues('email')}, a reset link was created.`}
        >
          <IconBadge icon={devPath ? KeyRound : MailCheck} tone="success" />
          {devPath ? (
            <Button as={Link} to={devPath} size="lg" className="w-full" rightIcon={ArrowRight}>
              Choose a new password
            </Button>
          ) : (
            <p className="text-center text-sm text-muted">Demo accounts use fixed passwords and can't be reset.</p>
          )}
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-300">
              <Terminal className="h-4 w-4" /> Development mode — no email is sent
            </p>
            <p className="mt-1 text-xs text-muted">
              The link is shown here and printed in the API console. It works once and expires after {minutes} minutes. On a production server, an
              administrator creates reset links instead.
            </p>
          </div>
          <Button as={Link} to="/login" variant="ghost" className="mt-4 w-full" leftIcon={ArrowLeft}>
            Back to sign in
          </Button>
        </AuthCard>
      );
    }

    return (
      <AuthCard title="Check your inbox" subtitle={`If an account exists for ${getValues('email')}, a reset link is on its way.`}>
        <IconBadge icon={MailCheck} tone="success" />
        <p className="text-center text-sm text-muted">
          The link expires in {minutes} minutes and can be used once. Check your spam folder if it doesn't arrive.
        </p>
        <Button as={Link} to="/login" variant="ghost" className="mt-6 w-full" leftIcon={ArrowLeft}>
          Back to sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle={
        mode === 'on-screen'
          ? 'Enter your account email to create a secure reset link.'
          : "Enter your account email and we'll send you a secure reset link."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Email" type="email" icon={Mail} autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} leftIcon={mode === 'on-screen' ? KeyRound : Send}>
          {mode === 'on-screen' ? 'Create reset link' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  );
}
