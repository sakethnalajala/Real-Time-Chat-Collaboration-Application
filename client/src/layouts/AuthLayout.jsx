import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { motion } from 'framer-motion';
import { CheckCheck, Lock, MessagesSquare, Users, Zap } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import AmbientBackground from '../components/ui/AmbientBackground.jsx';
import BackButton from '../components/ui/BackButton.jsx';
import { Spinner } from '../components/ui/Feedback.jsx';
import ThemeSwitch from '../components/layout/ThemeSwitch.jsx';
import { APP_NAME } from '../config/env.js';
import { cn } from '../utils/cn.js';

const FEATURES = [
  { icon: Zap, title: 'Real-time by default', text: 'Messages, typing and presence update instantly over WebSockets.' },
  { icon: CheckCheck, title: 'Delivery & read receipts', text: 'Know exactly when your message lands and gets seen.' },
  { icon: Users, title: 'Groups that scale', text: 'Roles, member management and shared files for every team.' },
  { icon: Lock, title: 'Secure by design', text: 'Hashed passwords, rotating sessions and role-based access.' },
];

/** Where "Back" leads from each authentication screen. */
const BACK_TARGETS = [
  { match: /^\/login/, to: '/', label: 'Back to home' },
  { match: /^\/register/, to: '/login', label: 'Back to sign in' },
  { match: /^\/forgot-password/, to: '/login', label: 'Back to sign in' },
  { match: /^\/reset-password/, to: '/login', label: 'Back to sign in' },
];

export default function AuthLayout() {
  const { pathname } = useLocation();
  const back = BACK_TARGETS.find((target) => target.match.test(pathname));
  // The sign-in page also hosts the demo account cards, so it gets a wider column.
  const wide = pathname.startsWith('/login');

  return (
    <div className="relative flex min-h-dvh bg-bg">
      <section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#08060f] p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start">
        <AmbientBackground intensity="strong" particles={12} />
        <Link to="/" className="relative w-fit [&_span]:text-white" aria-label={`${APP_NAME} home`}>
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl leading-tight font-bold tracking-tight"
          >
            Conversations that move <span className="text-gradient">at the speed of thought.</span>
          </motion.h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            {APP_NAME} brings private chats, team groups and file sharing into one fast, beautiful workspace.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature, index) => (
              <motion.li
                key={feature.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="flex gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand-300 shadow-inner shadow-white/5">
                  <feature.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{feature.title}</span>
                  <span className="block text-sm text-white/55">{feature.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-white/40">
          <MessagesSquare className="h-4 w-4" /> Built with React, Node.js, MongoDB & Socket.IO
        </div>
      </section>

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <AmbientBackground particles={8} />

        <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
          {back ? <BackButton to={back.to} label={back.label} /> : <span />}
          <ThemeSwitch />
        </header>

        <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn('relative w-full', wide ? 'max-w-2xl' : 'max-w-md')}
          >
            <Link to="/" className="mb-8 flex justify-center lg:hidden" aria-label={`${APP_NAME} home`}>
              <Logo />
            </Link>
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <Spinner />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
