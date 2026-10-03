import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Bell, Check, HardDrive, LogOut, Mail, Monitor, Moon, Palette, Settings, ShieldCheck, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { PageContainer } from '../../layouts/AppLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, PageHeader, SectionHeader, Switch } from '../../components/ui/Controls.jsx';
import { Badge } from '../../components/ui/Feedback.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { authService, userService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { desktopNotificationsSupported, playNotificationSound, requestDesktopPermission } from '../../utils/notify.js';
import { cn } from '../../utils/cn.js';

const THEMES = [
  { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#07060b]', bar: 'bg-[#16131f]', bubble: 'bg-violet-600' },
  { value: 'light', label: 'Light', icon: Sun, preview: 'bg-[#f6f5fb]', bar: 'bg-white', bubble: 'bg-violet-500' },
  { value: 'system', label: 'System', icon: Monitor, preview: 'bg-linear-to-r from-[#07060b] from-50% to-[#f6f5fb] to-50%', bar: 'bg-zinc-500/40', bubble: 'bg-violet-500' },
];

export default function SettingsPage() {
  useDocumentTitle('Settings · Nebula Chat');
  const { user, updateUser, endSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const settings = user.settings || {};
  const permission = desktopNotificationsSupported() ? Notification.permission : 'unsupported';

  const saveSettings = async (patch, key) => {
    const previous = settings;
    updateUser({ settings: { ...settings, ...patch } });
    setSaving(key);
    try {
      const { user: updated } = await userService.updateMe({ settings: patch });
      updateUser({ settings: updated.settings });
    } catch (error) {
      updateUser({ settings: previous });
      toast.error(getErrorMessage(error, 'Could not save your settings'));
    } finally {
      setSaving(null);
    }
  };

  const chooseTheme = (value) => {
    setTheme(value);
    saveSettings({ theme: value }, 'theme');
  };

  const toggleDesktop = async (enabled) => {
    if (enabled) {
      const result = await requestDesktopPermission();
      if (result !== 'granted') {
        toast.error(result === 'denied' ? 'Notifications are blocked in your browser settings for this site.' : 'Desktop notifications are not available.');
        return;
      }
    }
    saveSettings({ desktopNotifications: enabled }, 'desktop');
  };

  const logoutEverywhere = async () => {
    setLoggingOut(true);
    try {
      await authService.logoutAll();
      endSession();
      toast.success('Signed out of all devices');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setLoggingOut(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader icon={Settings} title="Settings" description="Personalise how Nebula looks and notifies you." />

      <div className="mt-6 space-y-4">
        <Card className="p-6">
          <SectionHeader title={<span className="flex items-center gap-2"><Palette className="h-4 w-4 text-brand-400" /> Appearance</span>} description="Dark black & purple is the signature look — light mode is one click away." />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {THEMES.map((option) => {
              const active = theme === option.value;
              return (
                <motion.button
                  key={option.value}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => chooseTheme(option.value)}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border p-3 text-left transition',
                    active ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-line hover:border-line-strong'
                  )}
                  aria-pressed={active}
                >
                  <div className={cn('flex h-20 flex-col justify-between rounded-xl border border-line p-2.5', option.preview)}>
                    <div className={cn('h-2 w-14 rounded-full', option.bar)} />
                    <div className="space-y-1.5">
                      <div className={cn('h-2.5 w-16 rounded-full', option.bar)} />
                      <div className={cn('ml-auto h-2.5 w-12 rounded-full', option.bubble)} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                      <option.icon className="h-4 w-4 text-muted" /> {option.label}
                    </span>
                    {active && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand-400" /> Notifications</span>} description="Choose how you're alerted about new activity." />
          <div className="mt-5 space-y-5">
            <Switch
              id="desktop-notifications"
              label="Desktop notifications"
              description={
                permission === 'unsupported'
                  ? 'Your browser does not support desktop notifications.'
                  : permission === 'denied'
                    ? 'Blocked by your browser — allow notifications for this site to enable.'
                    : 'Show a system notification for new messages while this tab is in the background.'
              }
              checked={Boolean(settings.desktopNotifications) && permission === 'granted'}
              disabled={permission === 'unsupported' || permission === 'denied' || saving === 'desktop'}
              onChange={toggleDesktop}
            />
            <Switch
              id="sound"
              label="Notification sound"
              description="Play a soft chime when a message arrives in another conversation."
              checked={settings.sound !== false}
              disabled={saving === 'sound'}
              onChange={(value) => {
                if (value) playNotificationSound();
                saveSettings({ sound: value }, 'sound');
              }}
            />
            <Switch
              id="previews"
              label="Message previews"
              description="Show message text in toasts and desktop notifications."
              checked={settings.messagePreviews !== false}
              disabled={saving === 'previews'}
              onChange={(value) => saveSettings({ messagePreviews: value }, 'previews')}
            />
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-400" /> Security</span>} description="Sessions are protected with rotating, httpOnly refresh tokens." />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/50 p-4">
            <div>
              <p className="text-sm font-semibold text-fg">Sign out of all devices</p>
              <p className="text-xs text-muted">Ends every active session, including this one.</p>
            </div>
            <Button variant="danger" size="sm" leftIcon={LogOut} onClick={() => setConfirmLogoutAll(true)}>
              Sign out everywhere
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader title="Server capabilities" description="Live configuration reported by the API." />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-line p-3">
              <HardDrive className="h-5 w-5 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">File sharing</p>
                <p className="text-xs text-muted">
                  {config.uploads?.enabled ? `Up to ${config.uploads.maxFileSizeMB} MB · ${config.uploads.maxFilesPerMessage} files per message` : 'Not configured'}
                </p>
              </div>
              <Badge tone={config.uploads?.enabled ? 'success' : 'warning'}>{config.uploads?.enabled ? config.uploads.driver : 'off'}</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line p-3">
              <Mail className="h-5 w-5 text-brand-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Password reset</p>
                <p className="text-xs text-muted">
                  {config.email?.configured
                    ? 'Reset links are sent by email'
                    : config.email?.devResetLinks
                      ? 'No email — the reset link is shown on screen (development)'
                      : 'No email — an administrator creates reset links'}
                </p>
              </div>
              <Badge tone={config.email?.configured || config.email?.devResetLinks ? 'success' : 'brand'}>
                {config.email?.configured ? 'email' : config.email?.devResetLinks ? 'on-screen' : 'admin'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmLogoutAll}
        onClose={() => setConfirmLogoutAll(false)}
        onConfirm={logoutEverywhere}
        loading={loggingOut}
        title="Sign out of all devices?"
        description="You'll need to sign in again on every device, including this one."
        confirmLabel="Sign out everywhere"
      />
    </PageContainer>
  );
}
