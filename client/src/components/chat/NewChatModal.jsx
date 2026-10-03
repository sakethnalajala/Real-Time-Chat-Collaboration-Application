import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquarePlus, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { conversationService } from '../../services/index.js';
import { getErrorMessage } from '../../services/api.js';
import { conversationKeys } from '../../hooks/useConversations.js';
import { upsertConversation } from '../../utils/messageCache.js';
import { EmptyState, ErrorState } from '../ui/Feedback.jsx';
import { SearchInput } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { UserListSkeleton, UserRow, useUserSearch } from './UserPicker.jsx';

/** Opens (or creates) a direct conversation and navigates to it. */
export function useOpenDirectChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async (userId) => {
    const { conversation } = await conversationService.openDirect(userId);
    queryClient.setQueryData(conversationKeys.detail(conversation._id), conversation);
    queryClient.setQueryData(conversationKeys.list, (list) => (list ? upsertConversation(list, conversation) : list));
    navigate(`/chats/${conversation._id}`);
    return conversation;
  };
}

export default function NewChatModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState(null);
  const openDirect = useOpenDirectChat();
  const { data, isLoading, isError, error, refetch } = useUserSearch(query);
  const users = data?.items || [];

  const start = async (user) => {
    setOpening(user._id);
    try {
      await openDirect(user._id);
      onClose();
      setQuery('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start the conversation'));
    } finally {
      setOpening(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New conversation" description="Start a private, real-time chat with anyone.">
      <div className="space-y-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or @username" autoFocus />
        <div className="max-h-[50vh] min-h-56 overflow-y-auto">
          {isLoading ? (
            <UserListSkeleton />
          ) : isError ? (
            <ErrorState compact message={getErrorMessage(error)} onRetry={refetch} />
          ) : users.length === 0 ? (
            <EmptyState compact icon={SearchX} title="No people found" description="Try another name or username." />
          ) : (
            <div className="space-y-0.5">
              {users.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  onClick={() => start(user)}
                  disabled={Boolean(opening)}
                  trailing={
                    opening === user._id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                    ) : (
                      <MessageSquarePlus className="h-4 w-4 text-subtle" />
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
