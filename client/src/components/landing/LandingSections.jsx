import { useRef } from 'react';
import { Link } from 'react-router';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  CheckCheck,
  FileCheck2,
  Fingerprint,
  Flag,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  MessageSquare,
  MessagesSquare,
  Paperclip,
  Radio,
  Rocket,
  ShieldCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { APP_NAME } from '../../config/env.js';
import { cn } from '../../utils/cn.js';
import AmbientBackground from '../ui/AmbientBackground.jsx';
import Button from '../ui/Button.jsx';
import Logo from '../ui/Logo.jsx';
import { LANDING_LINKS, scrollToSection } from './LandingNav.jsx';

const EASE = [0.22, 1, 0.36, 1];

export function Reveal({ children, delay = 0, className, y = 24 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const GRADIENT_TEXT =
  'bg-linear-to-r from-brand-600 via-fuchsia-500 to-brand-700 bg-clip-text text-transparent dark:from-brand-300 dark:via-fuchsia-300 dark:to-brand-400';

function SectionHeading({ eyebrow, title, description, align = 'center' }) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent-fg uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>}
    </Reveal>
  );
}

/** Card with a soft light that follows the cursor. */
function SpotlightCard({ children, className }) {
  const ref = useRef(null);
  const onMove = (event) => {
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    ref.current.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        'group relative h-full overflow-hidden rounded-3xl border border-line bg-surface/70 p-6 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-brand-500/35 hover:shadow-2xl hover:shadow-brand-900/15',
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--spot-x) var(--spot-y), rgba(139,92,246,0.16), transparent 45%)' }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function FeatureIcon({ icon: Icon }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-800/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
      <Icon className="h-6 w-6" />
    </span>
  );
}

const STACK = ['React 19', 'Vite', 'Tailwind CSS', 'Node.js', 'Express', 'MongoDB', 'Mongoose', 'Socket.IO', 'JWT', 'bcrypt', 'Cloudinary', 'Framer Motion'];

export function TechMarquee() {
  return (
    <section aria-label="Technology" className="relative py-10">
      <p className="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-subtle uppercase">Built on a modern, production-grade stack</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {[...STACK, ...STACK].map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-medium whitespace-nowrap text-muted backdrop-blur transition-colors hover:border-brand-500/40 hover:text-fg"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time messaging',
    text: 'Messages arrive instantly over WebSockets, with typing indicators and live updates across every open tab and device.',
    wide: true,
    extra: (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-typing rounded-full bg-brand-400" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          Maya is typing…
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-br-md bg-linear-to-br from-brand-500 to-brand-700 px-3 py-2 text-sm text-white">
          On my way! <CheckCheck className="h-4 w-4 text-sky-200" />
        </span>
      </div>
    ),
  },
  { icon: MessageSquare, title: 'Private chats', text: 'One-to-one conversations with replies, edits, deletes, emoji and full searchable history.' },
  { icon: Users, title: 'Group chats', text: 'Create groups with a name and photo, add members, and manage owner, admin and member roles.' },
  { icon: Bell, title: 'Smart notifications', text: 'In-app, toast and desktop notifications — grouped per conversation, silent while you are reading.' },
  { icon: Paperclip, title: 'File & image sharing', text: 'Drag and drop, paste or pick images, PDFs and documents, with previews and a lightbox.' },
  { icon: Radio, title: 'Online status & last seen', text: 'See who is online right now and when everyone was last active, updated live.' },
  { icon: CheckCheck, title: 'Delivery & read receipts', text: 'Ticks turn violet when your message is read — with per-member details in groups.' },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    text: 'bcrypt-hashed passwords, rotating sessions, role-based access, rate limiting and verified uploads.',
    wide: true,
  },
  { icon: Gauge, title: 'Admin & moderation', text: 'Dashboards, user management, report review, suspensions and a full audit trail for admins.', wide: true },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              Everything your team needs to <span className={GRADIENT_TEXT}>stay in sync</span>
            </>
          }
          description="From quick one-to-one chats to busy team groups, every conversation is fast, organised and secure."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 4) * 0.06} className={cn(feature.wide && 'sm:col-span-2')}>
              <SpotlightCard>
                <FeatureIcon icon={feature.icon} />
                <h3 className="mt-5 text-lg font-semibold text-fg">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.text}</p>
                {feature.extra}
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: UserPlus, title: 'Create your account', text: 'Sign up in seconds with a profile picture — or try one of the ready-made demo accounts.' },
  { icon: MessagesSquare, title: 'Start a conversation', text: 'Find people, open a private chat, or create a group and invite your team.' },
  { icon: Rocket, title: 'Collaborate in real time', text: 'Share files, reply in context and watch typing, presence and receipts update live.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="Up and running in three steps" />
        <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          <div aria-hidden className="absolute top-8 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-brand-500/50 to-transparent md:block" />
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.12} className="relative text-center">
              <div className="group mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-500/30 bg-surface/80 text-brand-400 shadow-lg shadow-brand-900/10 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/60 hover:shadow-brand-700/30">
                <step.icon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <span className="mt-5 inline-block text-xs font-bold tracking-widest text-accent-fg uppercase">Step {index + 1}</span>
              <h3 className="mt-2 text-xl font-semibold text-fg">{step.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Showcase() {
  const ref = useRef(null);
  const { resolvedTheme } = useTheme();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4, 1], [0.3, 0.85, 1]);

  return (
    <section id="showcase" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Showcase"
          title={
            <>
              Designed for focus. <span className={GRADIENT_TEXT}>Built for speed.</span>
            </>
          }
          description="A calm, premium workspace in dark or light — the real app, not a mock-up."
        />
        <div ref={ref} className="mt-14 [perspective:1600px]">
          <motion.div style={{ rotateX, scale, opacity }} className="relative origin-bottom">
            <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-linear-to-r from-brand-600/30 via-fuchsia-500/20 to-indigo-600/30 blur-3xl" />
            <figure className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-2xl shadow-brand-950/30">
              <div className="flex items-center gap-2 border-b border-line bg-surface-2/80 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-rose-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-3 hidden truncate rounded-lg bg-surface px-3 py-1 text-xs text-subtle sm:block">{APP_NAME} · Chats</span>
              </div>
              <img
                src={`/showcase/chat-${resolvedTheme === 'dark' ? 'dark' : 'light'}.png`}
                alt={`${APP_NAME} chat screen showing a conversation with replies and read receipts`}
                loading="lazy"
                className="block w-full"
              />
            </figure>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const SECURITY = [
  { icon: Lock, title: 'Hashed passwords', text: 'Every password is hashed with bcrypt — never stored or returned in plain text.' },
  { icon: KeyRound, title: 'Rotating sessions', text: 'Short-lived JWT access tokens and httpOnly refresh tokens that rotate on every use.' },
  { icon: Fingerprint, title: 'Role-based access', text: 'User and admin roles are enforced on every API route and real-time event.' },
  { icon: FileCheck2, title: 'Verified uploads', text: 'Files are checked by their real content, not just their extension, before they are stored.' },
  { icon: Gauge, title: 'Rate limiting', text: 'Sign-in, messaging and uploads are rate limited to stop abuse and brute-force attempts.' },
  { icon: Flag, title: 'Reporting & moderation', text: 'Members can report content; admins review evidence and act, with every action audited.' },
];

export function Security() {
  return (
    <section id="security" className="relative scroll-mt-20 py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Security"
            title={
              <>
                Private by default. <span className={GRADIENT_TEXT}>Protected everywhere.</span>
              </>
            }
            description="Security is built into every layer — from how passwords are stored to who can see what. Admins see conversation activity, never private message content."
          />
          <Reveal delay={0.1} className="mt-8">
            <div className="relative inline-flex h-28 w-28 items-center justify-center">
              <span aria-hidden className="absolute inset-0 animate-glow rounded-full bg-brand-500/30 blur-2xl" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-brand-500/30 bg-linear-to-br from-brand-500/25 to-fuchsia-500/10 text-brand-300 backdrop-blur">
                <ShieldCheck className="h-12 w-12 text-brand-400" />
              </span>
            </div>
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <SpotlightCard className="p-5">
                <item.icon className="h-6 w-6 text-brand-400 transition-transform duration-300 group-hover:scale-110" />
                <h3 className="mt-3 font-semibold text-fg">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-brand-500/30 bg-[#0d0918] px-6 py-16 text-center text-white shadow-2xl shadow-brand-950/40 sm:px-12">
        <AmbientBackground intensity="strong" particles={10} />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start the conversation today</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/65">
            Create an account in seconds, or jump straight in with a demo account and see real-time chat in action.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isAuthenticated ? (
              <Button as={Link} to="/dashboard" size="lg" leftIcon={LayoutDashboard}>
                Open your dashboard
              </Button>
            ) : (
              <>
                <Button as={Link} to="/register" size="lg" rightIcon={ArrowRight}>
                  Get started — it's free
                </Button>
                <Button as={Link} to="/login" size="lg" variant="outline" leftIcon={LogIn} className="border-white/20 text-white hover:border-white/40 hover:bg-white/10">
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-line bg-surface/40 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Real-time chat and collaboration for teams — private messages, groups, files and notifications in one place.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Product</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {LANDING_LINKS.map((link) => (
              <li key={link.id}>
                <button type="button" onClick={() => scrollToSection(link.id)} className="text-muted transition hover:text-fg">
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Account</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/login" className="text-muted transition hover:text-fg">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/register" className="text-muted transition hover:text-fg">
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/forgot-password" className="text-muted transition hover:text-fg">
                Forgot password
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-fg">Platform</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <li>Real-time messaging</li>
            <li>Groups & roles</li>
            <li>Notifications</li>
            <li>Admin & moderation</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-subtle sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {year} {APP_NAME}. All rights reserved.
          </p>
          <p>Built with React, Node.js, MongoDB & Socket.IO</p>
        </div>
      </div>
    </footer>
  );
}
