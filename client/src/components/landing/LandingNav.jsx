import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, LayoutDashboard, LogIn, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../utils/cn.js';
import Avatar from '../ui/Avatar.jsx';
import Button from '../ui/Button.jsx';
import Logo from '../ui/Logo.jsx';
import ThemeSwitch from '../layout/ThemeSwitch.jsx';

export const LANDING_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'showcase', label: 'Showcase' },
  { id: 'security', label: 'Security' },
];

export const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function LandingNav() {
  const { isAuthenticated, user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300',
        scrolled || open ? 'glass border-b border-line shadow-lg shadow-black/5' : 'border-b border-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Nebula Chat home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Homepage sections">
          {LANDING_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => go(link.id)}
              className="group relative rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              {link.label}
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-linear-to-r from-brand-400 to-fuchsia-400 transition-transform duration-300 group-hover:scale-x-100" />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {isAuthenticated ? (
              <>
                <Avatar src={user?.avatarUrl} name={user?.fullName} size="sm" />
                <Button as={Link} to="/dashboard" size="sm" rightIcon={ArrowRight}>
                  Open dashboard
                </Button>
              </>
            ) : (
              <>
                <Button as={Link} to="/login" variant="ghost" size="sm" leftIcon={LogIn}>
                  Sign in
                </Button>
                <Button as={Link} to="/register" size="sm" rightIcon={ArrowRight}>
                  Get started
                </Button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <ThemeSwitch />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <nav className="space-y-1 px-4 py-4" aria-label="Homepage sections">
              {LANDING_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => go(link.id)}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-fg transition hover:bg-surface-2"
                >
                  {link.label}
                </button>
              ))}
              <div className="grid gap-2 pt-3 sm:hidden">
                {isAuthenticated ? (
                  <Button as={Link} to="/dashboard" leftIcon={LayoutDashboard}>
                    Open dashboard
                  </Button>
                ) : (
                  <>
                    <Button as={Link} to="/register" rightIcon={ArrowRight}>
                      Get started
                    </Button>
                    <Button as={Link} to="/login" variant="secondary" leftIcon={LogIn}>
                      Sign in
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
