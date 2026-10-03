import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button.jsx';
import { PasswordInput } from '../../components/ui/Input.jsx';
import { Spinner } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { authService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { resetSchema } from '../../utils/validators.js';
import AuthCard from './AuthCard.jsx';

export default function ResetPasswordPage() {
  useDocumentTitle('Reset password · Nebula Chat');
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, endSession } = useAuth();

  const validation = useQuery({
    queryKey: ['reset-token', token],
    queryFn: () => authService.validateResetToken(token),
    retry: false,
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = async (values) => {
    try {
      const result = await authService.resetPassword(token, values);
      toast.success(result.message || 'Password updated. Please sign in.');
      if (isAuthenticated) endSession();
      navigate('/login', { replace: true });
    } catch (error) {
      setError('root', { message: getErrorMessage(error, 'Unable to reset your password') });
    }
  };

  if (validation.isLoading) {
    return (
      <AuthCard title="Checking your link…">
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </AuthCard>
    );
  }

  if (validation.isError) {
    return (
      <AuthCard title="Link expired or invalid" subtitle={getErrorMessage(validation.error, 'This reset link is invalid or has expired.')}>
        <div className="mb-6 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500">
            <LinkIcon className="h-7 w-7" />
          </span>
        </div>
        <Button as={Link} to="/forgot-password" className="w-full" size="lg">
          Request a new link
        </Button>
        <Button as={Link} to="/login" variant="ghost" className="mt-2 w-full" leftIcon={ArrowLeft}>
          Back to sign in
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Make it strong — you'll be signed out of all other devices.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          showStrength
          value={watch('password')}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} leftIcon={KeyRound}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
