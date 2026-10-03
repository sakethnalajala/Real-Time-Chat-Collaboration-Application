import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, Camera, Mail, Trash2, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button.jsx';
import { Input, PasswordInput } from '../../components/ui/Input.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useDocumentTitle, useObjectUrl } from '../../hooks/useUtils.js';
import { getErrorMessage, getFieldErrors } from '../../services/api.js';
import { registerSchema } from '../../utils/validators.js';
import { firstName } from '../../utils/format.js';
import AuthCard from './AuthCard.jsx';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function RegisterPage() {
  useDocumentTitle('Create account · Nebula Chat');
  const { register: registerAccount } = useAuth();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [avatar, setAvatar] = useState(null);
  const preview = useObjectUrl(avatar);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', username: '', email: '', password: '', confirmPassword: '' },
  });

  const fullName = watch('fullName');
  const password = watch('password');
  const maxMB = config.uploads?.maxAvatarSizeMB ?? 5;

  const pickAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error('Please choose a JPG, PNG, WebP or GIF image');
    if (file.size > maxMB * 1024 * 1024) return toast.error(`Profile pictures must be ${maxMB} MB or smaller`);
    setAvatar(file);
  };

  const onSubmit = async (values) => {
    try {
      const user = await registerAccount({ ...values, avatar });
      toast.success(`Welcome to Nebula, ${firstName(user.fullName)}! 🎉`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const fields = getFieldErrors(error);
      Object.entries(fields).forEach(([name, message]) => setError(name, { message }));
      if (!Object.keys(fields).length) setError('root', { message: getErrorMessage(error, 'Unable to create your account') });
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join in seconds — your conversations, beautifully organised."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent-fg hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-line bg-surface-2/40 p-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!config.uploads?.enabled}
            className="group relative rounded-full"
            aria-label="Choose profile picture"
          >
            <Avatar src={preview} name={fullName || 'New user'} size="xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Profile picture</p>
            <p className="text-xs text-muted">
              {config.uploads?.enabled ? `Optional · JPG, PNG, WebP or GIF up to ${maxMB} MB` : 'Image uploads are not configured on this server yet.'}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="secondary" leftIcon={Camera} onClick={() => fileRef.current?.click()} disabled={!config.uploads?.enabled}>
                {avatar ? 'Change' : 'Upload'}
              </Button>
              {avatar && (
                <Button size="xs" variant="danger-ghost" leftIcon={Trash2} onClick={() => setAvatar(null)}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={pickAvatar} />
        </div>

        <Input label="Full name" icon={User} autoComplete="name" placeholder="Ada Lovelace" error={errors.fullName?.message} {...register('fullName')} />
        <Input
          label="Username"
          icon={AtSign}
          autoComplete="username"
          placeholder="ada.codes"
          error={errors.username?.message}
          hint="3–20 characters: letters, numbers, dots and underscores"
          {...register('username')}
        />
        <Input label="Email" type="email" icon={Mail} autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          showStrength
          value={password}
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {errors.root && (
          <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} leftIcon={UserPlus}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
