import { useOutletContext } from 'react-router';
import { motion } from 'framer-motion';
import { CheckCheck, Lock, MessageSquarePlus, Users, Zap } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

const TIPS = [
  { icon: Zap, text: 'Messages, typing and presence update instantly' },
  { icon: CheckCheck, text: 'Ticks turn violet when your message is read' },
  { icon: Lock, text: 'Drag & drop images or files to share them' },
];

export default function ChatEmptyPage() {
  const { openNewChat, openNewGroup } = useOutletContext();
  return (
    <div className="chat-pattern flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl brand-gradient shadow-2xl shadow-brand-700/40">
          <MessageSquarePlus className="h-10 w-10 text-white" />
        </div>
      </motion.div>
      <h2 className="text-2xl font-bold tracking-tight text-fg">Pick up where you left off</h2>
      <p className="mt-2 max-w-md text-sm text-muted">Select a conversation from the list, or start something new with a person or a whole team.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button leftIcon={MessageSquarePlus} onClick={openNewChat}>
          New chat
        </Button>
        <Button variant="secondary" leftIcon={Users} onClick={openNewGroup}>
          Create group
        </Button>
      </div>
      <ul className="mt-10 space-y-2.5 text-left">
        {TIPS.map((tip, index) => (
          <motion.li
            key={tip.text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.08 }}
            className="flex items-center gap-3 text-sm text-muted"
          >
            <tip.icon className="h-4 w-4 text-brand-400" /> {tip.text}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
