import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, LayoutDashboard, LogIn, Sparkles } from 'lucide-react';
import AmbientBackground from '../components/ui/AmbientBackground.jsx';
import Button from '../components/ui/Button.jsx';
import HeroIllustration from '../components/landing/HeroIllustration.jsx';
import LandingNav from '../components/landing/LandingNav.jsx';
import { Features, FinalCta, Footer, GRADIENT_TEXT, HowItWorks, Security, Showcase, TechMarquee } from '../components/landing/LandingSections.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useUtils.js';
import { APP_NAME } from '../config/env.js';

const EASE = [0.22, 1, 0.36, 1];
const enter = (delay) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE, delay },
});

const HIGHLIGHTS = ['Instant delivery', 'Read receipts', 'Secure by design'];

function Hero() {
  const { isAuthenticated, user } = useAuth();
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8">
        <div className="text-center lg:text-left">
          <motion.p
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-surface/70 py-1.5 pr-4 pl-2 text-xs font-medium text-muted shadow-lg shadow-brand-900/10 backdrop-blur"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2 py-0.5 font-semibold text-accent-fg">
              <Sparkles className="h-3 w-3" /> New
            </span>
            Real-time messaging, groups & file sharing
          </motion.p>

          <motion.h1 {...enter(0.08)} className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight text-fg sm:text-5xl lg:text-6xl">
            Real-time conversations <span className={GRADIENT_TEXT}>for teams that move fast.</span>
          </motion.h1>

          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
            {APP_NAME} brings private messages, group collaboration, file sharing and live notifications into one secure, beautifully fast
            workspace — with typing indicators, read receipts and online status built in.
          </motion.p>

          <motion.div {...enter(0.24)} className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            {isAuthenticated ? (
              <Button as={Link} to="/dashboard" size="lg" leftIcon={LayoutDashboard} className="group">
                Continue as {user?.fullName?.split(' ')[0] ?? 'you'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <>
                <Button as={Link} to="/register" size="lg" className="group relative overflow-hidden">
                  <span aria-hidden className="absolute inset-0 -translate-x-full animate-shine bg-linear-to-r from-transparent via-white/25 to-transparent" />
                  Get started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button as={Link} to="/login" size="lg" variant="secondary" leftIcon={LogIn}>
                  Sign in
                </Button>
              </>
            )}
          </motion.div>

          <motion.ul {...enter(0.32)} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-400" /> {item}
              </li>
            ))}
          </motion.ul>
          {!isAuthenticated && (
            <motion.p {...enter(0.4)} className="mt-4 text-xs text-subtle">
              Want a quick look? The sign-in page has four ready-to-use demo accounts.
            </motion.p>
          )}
        </div>

        <HeroIllustration />
      </div>
    </section>
  );
}

export default function LandingPage() {
  useDocumentTitle(`${APP_NAME} — Real-time chat & collaboration`);
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1100px] [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
        <AmbientBackground intensity="strong" particles={18} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[1900px] h-[1200px] opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]">
        <AmbientBackground particles={8} />
      </div>
      <LandingNav />
      <main className="relative">
        <Hero />
        <TechMarquee />
        <Features />
        <HowItWorks />
        <Showcase />
        <Security />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
