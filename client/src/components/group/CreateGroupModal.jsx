import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Rocket, Users } from 'lucide-react';
import { toast } from 'sonner';
import { conversationService } from '../../services/index.js';
import { getErrorMessage, getFieldErrors } from '../../services/api.js';
import { conversationKeys } from '../../hooks/useConversations.js';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { useObjectUrl } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { upsertConversation } from '../../utils/messageCache.js';
import { cn } from '../../utils/cn.js';
import Avatar, { AvatarStack } from '../ui/Avatar.jsx';
import Button from '../ui/Button.jsx';
import { Input, Textarea } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import UserPicker from '../chat/UserPicker.jsx';
import GroupImagePicker from './GroupImagePicker.jsx';

const STEPS = ['Details', 'Members', 'Review'];

/** Create Group → name & image → select members → create → open the new conversation. */
export default function CreateGroupModal({ open, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { config } = useAppConfig();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [members, setMembers] = useState([]);
  const [errors, setErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const imagePreview = useObjectUrl(image);

  const reset = () => {
    setStep(0);
    setName('');
    setDescription('');
    setImage(null);
    setMembers([]);
    setErrors({});
  };

  const close = () => {
    if (creating) return;
    onClose();
    setTimeout(reset, 250);
  };

  const go = (next) => {
    if (next > step) {
      if (step === 0 && !name.trim()) return setErrors({ name: 'Give your group a name' });
      if (step === 1 && members.length === 0) return setErrors({ members: 'Select at least one member' });
    }
    setErrors({});
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const create = async () => {
    setCreating(true);
    try {
      const { conversation } = await conversationService.createGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: members.map((m) => m._id),
        image,
      });
      queryClient.setQueryData(conversationKeys.detail(conversation._id), conversation);
      queryClient.setQueryData(conversationKeys.list, (list) => (list ? upsertConversation(list, conversation) : list));
      toast.success(`"${conversation.group.name}" is ready — say hello 👋`);
      onClose();
      setTimeout(reset, 250);
      navigate(`/chats/${conversation._id}`);
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields.name) {
        setErrors({ name: fields.name });
        setDirection(-1);
        setStep(0);
      }
      toast.error(getErrorMessage(error, 'Could not create the group'));
    } finally {
      setCreating(false);
    }
  };

  const maxMembers = (config.limits?.groupMaxMembers ?? 100) - 1;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create a group"
      description="Bring people together in one shared conversation."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" leftIcon={ArrowLeft} onClick={() => (step === 0 ? close() : go(step - 1))} disabled={creating}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 2 ? (
            <Button rightIcon={ArrowRight} onClick={() => go(step + 1)}>
              {step === 1 ? `Continue${members.length ? ` (${members.length})` : ''}` : 'Continue'}
            </Button>
          ) : (
            <Button leftIcon={Rocket} onClick={create} loading={creating}>
              Create group
            </Button>
          )}
        </div>
      }
    >
      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                index < step && 'border-brand-500 bg-brand-500 text-white',
                index === step && 'border-brand-500 bg-brand-500/15 text-accent-fg',
                index > step && 'border-line text-subtle'
              )}
            >
              {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn('hidden text-xs font-semibold sm:block', index === step ? 'text-fg' : 'text-subtle')}>{label}</span>
            {index < STEPS.length - 1 && (
              <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span className="absolute inset-y-0 left-0 bg-brand-500" animate={{ width: index < step ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {step === 0 && (
              <div className="space-y-5">
                <GroupImagePicker file={image} onChange={setImage} maxMB={config.uploads?.maxAvatarSizeMB ?? 5} disabled={!config.uploads?.enabled} />
                <Input
                  label="Group name"
                  placeholder="e.g. Design Team ✨"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                  data-autofocus
                  onKeyDown={(e) => e.key === 'Enter' && go(1)}
                />
                <Textarea
                  label="Description"
                  placeholder="What is this group about? (optional)"
                  value={description}
                  maxLength={300}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            {step === 1 && (
              <div>
                <UserPicker selected={members} onChange={setMembers} excludeIds={[user._id]} max={maxMembers} />
                {errors.members && <p className="mt-2 text-xs font-medium text-rose-500">{errors.members}</p>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <Avatar name={name} size="xl" rounded="rounded-2xl" isGroup />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-fg">{name}</p>
                    {description && <p className="line-clamp-2 text-sm text-muted">{description}</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                    <Users className="h-4 w-4 text-brand-400" /> {members.length + 1} members
                  </p>
                  <div className="flex items-center gap-3">
                    <AvatarStack users={[user, ...members]} max={7} size="md" />
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    You'll be the group owner. Members are notified instantly and the conversation opens right away.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}
