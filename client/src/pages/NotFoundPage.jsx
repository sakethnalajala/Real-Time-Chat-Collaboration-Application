import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { useDocumentTitle } from '../hooks/useUtils.js';

export default function NotFoundPage() {
  useDocumentTitle('Page not found · Nebula Chat');
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-bg px-6 text-center">
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" />
      <motion.p
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative text-8xl font-extrabold tracking-tighter text-gradient"
      >
        404
      </motion.p>
      <h1 className="relative text-xl font-bold text-fg">This page drifted into deep space</h1>
      <p className="relative max-w-sm text-sm text-muted">The link may be broken, or the page may have been removed.</p>
      <Button as={Link} to="/" leftIcon={Compass} className="relative">
        Back to home
      </Button>
    </div>
  );
}
