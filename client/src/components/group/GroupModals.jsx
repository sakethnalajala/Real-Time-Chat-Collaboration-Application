import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { conversationService } from '../../services/index.js';
import { getErrorMessage, getFieldErrors } from '../../services/api.js';
import { conversationKeys } from '../../hooks/useConversations.js';
import { useAppConfig } from '../../hooks/useAppConfig.js';
import { upsertConversation } from '../../utils/messageCache.js';
import Button from '../ui/Button.jsx';
import { Input, Textarea } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import UserPicker from '../chat/UserPicker.jsx';
import GroupImagePicker from './GroupImagePicker.jsx';

function useStoreConversation() {
  const queryClient = useQueryClient();
  return (conversation) => {
    queryClient.setQueryData(conversationKeys.detail(conversation._id), conversation);
    queryClient.setQueryData(conversationKeys.list, (list) => (list ? upsertConversation(list, conversation) : list));
  };
}

export function AddMembersModal({ open, onClose, conversation }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const { config } = useAppConfig();
  const store = useStoreConversation();
  const existing = conversation.participants.map((p) => p.user._id);
  const room = (config.limits?.groupMaxMembers ?? 100) - existing.length;

  useEffect(() => {
    if (!open) setSelected([]);
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await conversationService.addMembers(conversation._id, selected.map((u) => u._id));
      store(result.conversation);
      toast.success(`Added ${selected.length} ${selected.length === 1 ? 'member' : 'members'}`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add members'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Add members"
      description={`Invite people to ${conversation.group?.name}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button leftIcon={UserPlus} onClick={submit} loading={saving} disabled={!selected.length}>
            Add {selected.length || ''}
          </Button>
        </>
      }
    >
      <UserPicker selected={selected} onChange={setSelected} excludeIds={existing} max={Math.max(room, 0)} />
    </Modal>
  );
}

export function EditGroupModal({ open, onClose, conversation }) {
  const { config } = useAppConfig();
  const store = useStoreConversation();
  const [name, setName] = useState(conversation.group?.name ?? '');
  const [description, setDescription] = useState(conversation.group?.description ?? '');
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(conversation.group?.name ?? '');
      setDescription(conversation.group?.description ?? '');
      setImage(null);
      setRemoveImage(false);
      setErrors({});
    }
  }, [open, conversation.group?.name, conversation.group?.description]);

  const submit = async () => {
    if (!name.trim()) return setErrors({ name: 'Group name is required' });
    setSaving(true);
    try {
      const result = await conversationService.updateGroup(conversation._id, {
        name: name.trim(),
        description: description.trim(),
        removeImage: removeImage && !image ? 'true' : undefined,
        image,
      });
      store(result.conversation);
      toast.success('Group updated');
      onClose();
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error, 'Could not update the group'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Edit group"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button leftIcon={Save} onClick={submit} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <GroupImagePicker
          file={image}
          onChange={(file) => {
            setImage(file);
            if (file) setRemoveImage(false);
          }}
          currentUrl={removeImage ? null : conversation.group?.avatarUrl}
          onRemoveCurrent={() => setRemoveImage(true)}
          maxMB={config.uploads?.maxAvatarSizeMB ?? 5}
          disabled={!config.uploads?.enabled}
        />
        <Input label="Group name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Textarea label="Description" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
      </div>
    </Modal>
  );
}
