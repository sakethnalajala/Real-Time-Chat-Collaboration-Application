import { Suspense, useState } from 'react';
import { Outlet, useParams } from 'react-router';
import ConversationList from '../../components/chat/ConversationList.jsx';
import NewChatModal from '../../components/chat/NewChatModal.jsx';
import CreateGroupModal from '../../components/group/CreateGroupModal.jsx';
import { PageLoader } from '../../components/ui/Feedback.jsx';
import { useTotalUnread } from '../../hooks/useConversations.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { cn } from '../../utils/cn.js';

/** Two-pane messenger: conversation list + active chat. On phones only one pane is visible. */
export default function ChatsPage() {
  const { conversationId } = useParams();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const unread = useTotalUnread();
  useDocumentTitle(`${unread ? `(${unread}) ` : ''}Chats · Nebula Chat`);

  return (
    <div className="flex h-full">
      <section
        className={cn(
          'h-full w-full shrink-0 border-r border-line bg-surface/40 md:w-[330px] lg:w-[370px]',
          conversationId ? 'hidden md:block' : 'block'
        )}
        aria-label="Conversations"
      >
        <ConversationList onNewChat={() => setNewChatOpen(true)} onNewGroup={() => setNewGroupOpen(true)} />
      </section>

      <section className={cn('h-full min-w-0 flex-1', conversationId ? 'block' : 'hidden md:block')}>
        <Suspense fallback={<PageLoader label="Opening conversation…" />}>
          <Outlet context={{ openNewChat: () => setNewChatOpen(true), openNewGroup: () => setNewGroupOpen(true) }} />
        </Suspense>
      </section>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
      <CreateGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
    </div>
  );
}
