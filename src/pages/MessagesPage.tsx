import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  CheckCheck,
  Image as ImageIcon,
  MessageSquarePlus,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import { AuthGateNotice } from '../components/AuthGateNotice';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import { apiFetch } from '../lib/api';
import type { MessageRecord } from '../types/estora';
import { buildThreadKey, groupMessagesIntoThreads, isSafeMessageImageUrl } from '../utils/social';

interface MessagesPageProps {
  querySearch?: string;
  onNavigate?: (path: string) => void;
}

type ThreadFilter = 'all' | 'incoming' | 'unread';

export function MessagesPage({ querySearch = '' }: MessagesPageProps) {
  const { idToken, dbUser } = useAuth();
  const { t, formatDate } = useI18n();
  const { subscribeRealtime, refreshUnreadMessages } = useRealtime();

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [composeNewMode, setComposeNewMode] = useState(false);

  // Reply / new inquiry composer state
  const [newSubject, setNewSubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [attachedImageUrl, setAttachedImageUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [deepLinkTarget, setDeepLinkTarget] = useState<{
    otherUserId: number;
    propertyId: number | null;
  } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(
    async (token: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ messages: MessageRecord[] }>('/api/messages', { token });
        setMessages(res.messages);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.common.loadingError);
      } finally {
        setLoading(false);
      }
    },
    [t.common.loadingError]
  );

  useEffect(() => {
    if (!idToken) return;
    void loadMessages(idToken);
  }, [idToken, loadMessages]);

  const threads = useMemo(() => {
    if (!dbUser) return [];
    return groupMessagesIntoThreads(messages, dbUser.id);
  }, [messages, dbUser]);

  // Parse deep-link ?with=<userId>&propertyId=<propId>
  useEffect(() => {
    const params = new URLSearchParams(querySearch);
    const withRaw = params.get('with');
    const propRaw = params.get('propertyId');
    const withId = withRaw ? Number(withRaw) : NaN;
    const propId = propRaw ? Number(propRaw) : null;

    if (!Number.isNaN(withId) && withId > 0) {
      const targetKey = buildThreadKey(withId, propId && !Number.isNaN(propId) ? propId : null);
      setDeepLinkTarget({
        otherUserId: withId,
        propertyId: propId && !Number.isNaN(propId) ? propId : null,
      });
      const exactMatch = threads.find((th) => th.threadKey === targetKey);
      const userMatch = threads.find((th) => th.otherUserId === withId);
      if (exactMatch) {
        setSelectedThreadKey(exactMatch.threadKey);
        setComposeNewMode(false);
      } else if (userMatch) {
        setSelectedThreadKey(userMatch.threadKey);
        setComposeNewMode(false);
      } else {
        setComposeNewMode(true);
        setSelectedThreadKey(null);
      }
    }
  }, [querySearch, threads]);

  // Auto-select first thread if none selected and not composing new
  useEffect(() => {
    if (!composeNewMode && !selectedThreadKey && threads.length > 0) {
      setSelectedThreadKey(threads[0].threadKey);
    }
  }, [threads, selectedThreadKey, composeNewMode]);

  // Subscribe to real-time incoming messages and read receipts
  useEffect(() => {
    if (!dbUser) return;
    return subscribeRealtime((event) => {
      if (event.type === 'message:created' && event.payload) {
        const incoming = event.payload as MessageRecord;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
      } else if (event.type === 'message:read' && event.payload) {
        const info = event.payload as {
          messageIds?: number[];
          readAt?: string;
        };
        if (Array.isArray(info.messageIds) && info.messageIds.length > 0) {
          const readSet = new Set(info.messageIds);
          setMessages((prev) =>
            prev.map((m) =>
              readSet.has(m.id) ? { ...m, isRead: true, readAt: info.readAt ?? m.readAt } : m
            )
          );
        }
      }
    });
  }, [dbUser, subscribeRealtime]);

  const filteredThreads = useMemo(() => {
    if (!dbUser) return threads;
    return threads.filter((th) => {
      if (threadFilter === 'unread') return th.unreadCount > 0;
      if (threadFilter === 'incoming') {
        return th.lastMessage.recipientId === dbUser.id || th.unreadCount > 0;
      }
      return true;
    });
  }, [threads, threadFilter, dbUser]);

  const activeThread = useMemo(
    () => threads.find((th) => th.threadKey === selectedThreadKey) ?? null,
    [threads, selectedThreadKey]
  );

  const activeThreadMessages = useMemo(() => {
    if (!dbUser || !activeThread) return [];
    return messages
      .filter((m) => {
        const isOutgoing = m.senderId === dbUser.id;
        const otherId = isOutgoing ? m.recipientId : m.senderId;
        const propId = m.propertyId ?? null;
        return buildThreadKey(otherId, propId) === activeThread.threadKey;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, activeThread, dbUser]);

  // Mark unread incoming messages as read when thread is opened
  useEffect(() => {
    if (!idToken || !dbUser || !activeThread) return;
    if (activeThread.unreadCount <= 0) return;

    void apiFetch('/api/messages/read', {
      method: 'PATCH',
      token: idToken,
      body: JSON.stringify({
        otherUserId: activeThread.otherUserId,
        propertyId: activeThread.propertyId,
      }),
    })
      .then((res: unknown) => {
        const data = res as { updatedIds?: number[]; readAt?: string };
        const updatedSet = new Set(data.updatedIds ?? []);
        setMessages((prev) =>
          prev.map((m) =>
            updatedSet.has(m.id) ? { ...m, isRead: true, readAt: data.readAt ?? m.readAt } : m
          )
        );
        void refreshUnreadMessages();
      })
      .catch(() => {});
  }, [idToken, dbUser, activeThread, refreshUnreadMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeThreadMessages.length]);

  const handleAttachPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !idToken) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('kind', 'photo');
      formData.append('file', file);
      const res = await apiFetch<{ asset?: { url?: string } }>('/api/uploads', {
        method: 'POST',
        token: idToken,
        body: formData,
      });
      const url = res.asset?.url ?? '';
      if (!url || !isSafeMessageImageUrl(url)) {
        throw new Error(t.messages.sendError);
      }
      setAttachedImageUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.messages.sendError);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!idToken || !dbUser) return;
    setError(null);

    const isNew = composeNewMode || !activeThread;
    if (isNew && !deepLinkTarget && !newSubject.trim()) {
      setError(t.messages.validationError);
      return;
    }
    if (!replyBody.trim() && !attachedImageUrl) {
      setError(t.messages.validationError);
      return;
    }

    setSending(true);
    try {
      const payload = isNew
        ? {
            recipientId: deepLinkTarget?.otherUserId ?? undefined,
            propertyId: deepLinkTarget?.propertyId ?? undefined,
            subject: newSubject.trim() || t.messages.newInquiry,
            body: replyBody.trim(),
            imageUrl: attachedImageUrl,
          }
        : {
            recipientId: activeThread.otherUserId,
            propertyId: activeThread.propertyId ?? undefined,
            subject: activeThread.subject,
            body: replyBody.trim(),
            imageUrl: attachedImageUrl,
          };

      const res = await apiFetch<{ message: MessageRecord }>('/api/messages', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify(payload),
      });

      setReplyBody('');
      setNewSubject('');
      setAttachedImageUrl('');
      setComposeNewMode(false);
      setDeepLinkTarget(null);

      if (res.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === res.message.id) ? prev : [res.message, ...prev]
        );
        const targetOther =
          res.message.senderId === dbUser.id ? res.message.recipientId : res.message.senderId;
        setSelectedThreadKey(buildThreadKey(targetOther, res.message.propertyId ?? null));
      } else {
        await loadMessages(idToken);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.messages.sendError);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
            {t.messages.title}
          </h1>
          <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">{t.messages.subtitle}</p>
        </div>

        {idToken && (
          <button
            type="button"
            onClick={() => {
              setComposeNewMode(true);
              setSelectedThreadKey(null);
              setError(null);
            }}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[14px] bg-[#143A30] px-4 text-xs font-medium text-white hover:bg-[#0F2C24]"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            <span>{t.messagesExtra.newChatBtn}</span>
          </button>
        )}
      </div>

      <div className="mt-8">
        {!idToken || !dbUser ? (
          <AuthGateNotice title={t.messages.authTitle} description={t.messages.authDesc} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Threads Sidebar */}
            <aside className="rounded-[20px] border border-[#E5E4E0] bg-white p-4 lg:col-span-4 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E4E0] dark:border-[#2C2C2C]">
                <h2 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.messagesExtra.threadsTitle}
                </h2>
                <span className="font-mono text-xs text-[#737373] tabular-nums dark:text-[#A0A0A0]">
                  {threads.length}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-[12px] bg-[#F8F8F7] p-1 dark:bg-[#141414]">
                {(
                  [
                    { id: 'all', label: t.messagesExtra.filterAll },
                    { id: 'incoming', label: t.messagesExtra.filterIncoming },
                    { id: 'unread', label: t.messagesExtra.filterUnread },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setThreadFilter(tab.id)}
                    className={`min-h-[32px] rounded-[9px] px-2 text-xs font-medium transition-colors ${
                      threadFilter === tab.id
                        ? 'bg-white text-[#143A30] shadow-xs dark:bg-[#262626] dark:text-[#D4B483]'
                        : 'text-[#525252] dark:text-[#A0A0A0]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 max-h-[520px] space-y-1.5 overflow-y-auto">
                {loading && threads.length === 0 ? (
                  <div className="h-40 animate-pulse rounded-[14px] bg-[#F8F8F7] dark:bg-[#141414]" />
                ) : filteredThreads.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#737373] dark:text-[#A0A0A0]">
                    {t.messages.empty}
                  </p>
                ) : (
                  filteredThreads.map((th) => {
                    const selected = !composeNewMode && th.threadKey === selectedThreadKey;
                    const initials = th.otherUserName.slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={th.threadKey}
                        type="button"
                        onClick={() => {
                          setComposeNewMode(false);
                          setSelectedThreadKey(th.threadKey);
                          setError(null);
                        }}
                        className={`flex w-full items-start gap-3 rounded-[14px] border p-3 text-start transition-colors ${
                          selected
                            ? 'border-[#143A30] bg-[#F3F7F5] dark:border-[#D4B483] dark:bg-[#1F2724]'
                            : 'border-transparent hover:bg-[#F8F8F7] dark:hover:bg-[#242424]'
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#143A30] text-xs font-semibold text-white dark:bg-[#2A2A2A] dark:text-[#D4B483]">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {th.otherUserName}
                            </span>
                            <span className="font-mono text-[11px] text-[#737373] shrink-0 tabular-nums dark:text-[#A0A0A0]">
                              {formatDate(th.lastMessage.createdAt)}
                            </span>
                          </div>
                          {th.propertyTitle && (
                            <p className="truncate text-[11px] font-medium text-[#8C6D46] dark:text-[#D4B483]">
                              {th.propertyTitle}
                            </p>
                          )}
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-[#525252] dark:text-[#A0A0A0]">
                              {th.lastMessage.imageUrl && !th.lastMessage.body
                                ? t.messagesExtra.photoCaption
                                : th.lastMessage.body}
                            </p>
                            {th.unreadCount > 0 && (
                              <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-[8px] bg-[#143A30] px-1.5 font-mono text-[11px] font-semibold text-white dark:bg-[#D4B483] dark:text-[#111111]">
                                {th.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Chat / Inquiry Main Pane */}
            <section className="flex min-h-[540px] flex-col rounded-[20px] border border-[#E5E4E0] bg-white lg:col-span-8 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
              {composeNewMode || !activeThread ? (
                <form onSubmit={(e) => void handleSend(e)} className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    {t.messages.newInquiry}
                  </h2>
                  <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
                    {t.messagesExtra.selectThreadHint}
                  </p>

                  <div className="mt-5 space-y-4 flex-1">
                    <div>
                      <label
                        htmlFor="msg-subject"
                        className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                      >
                        {t.messages.subject}
                      </label>
                      <input
                        id="msg-subject"
                        type="text"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        placeholder={t.messages.subjectPlaceholder}
                        className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="msg-body"
                        className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                      >
                        {t.messages.body}
                      </label>
                      <textarea
                        id="msg-body"
                        rows={5}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder={t.messages.bodyPlaceholder}
                        className="mt-1.5 w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 py-2 text-xs font-medium text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]">
                        <ImageIcon className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                        <span>
                          {uploadingPhoto
                            ? t.messagesExtra.uploadingPhoto
                            : t.messagesExtra.attachPhoto}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void handleAttachPhoto(e)}
                          disabled={uploadingPhoto}
                          className="sr-only"
                        />
                      </label>

                      {attachedImageUrl && (
                        <div className="flex items-center gap-2 rounded-[12px] border border-[#E5E4E0] px-2.5 py-1.5 text-xs dark:border-[#343434]">
                          <img
                            src={attachedImageUrl}
                            alt={t.messagesExtra.photoAttached}
                            className="h-8 w-8 rounded-[6px] object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setAttachedImageUrl('')}
                            className="text-[#991B1B] hover:underline dark:text-[#FCA5A5]"
                          >
                            {t.messagesExtra.removePhoto}
                          </button>
                        </div>
                      )}
                    </div>

                    {error && <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={sending || uploadingPhoto}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#143A30] px-6 text-sm font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
                    >
                      <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      <span>{sending ? t.messages.sending : t.messages.send}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Active Thread Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E4E0] px-5 py-4 dark:border-[#2C2C2C]">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        {activeThread.otherUserName}
                      </h2>
                      <p className="truncate text-xs text-[#8C6D46] dark:text-[#D4B483]">
                        {activeThread.propertyTitle || activeThread.subject}
                      </p>
                    </div>
                  </div>

                  {/* Chronological Messages */}
                  <div className="flex-1 max-h-[420px] space-y-3 overflow-y-auto p-5">
                    {activeThreadMessages.map((msg) => {
                      const isOutgoing = msg.senderId === dbUser.id;
                      const safeImg =
                        msg.imageUrl && isSafeMessageImageUrl(msg.imageUrl) ? msg.imageUrl : '';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-[18px] px-4 py-3 text-sm ${
                              isOutgoing
                                ? 'bg-[#143A30] text-white'
                                : 'border border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]'
                            }`}
                          >
                            {safeImg && (
                              <button
                                type="button"
                                onClick={() => setLightboxImage(safeImg)}
                                className="mb-2 block overflow-hidden rounded-[12px]"
                              >
                                <img
                                  src={safeImg}
                                  alt={t.messagesExtra.photoCaption}
                                  className="max-h-56 w-auto rounded-[12px] object-cover"
                                />
                              </button>
                            )}
                            {msg.body && <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-[#737373] dark:text-[#A0A0A0]">
                            <span className="font-mono tabular-nums">
                              {formatDate(msg.createdAt, true)}
                            </span>
                            {isOutgoing && (
                              <span
                                className={`inline-flex items-center gap-0.5 ${
                                  msg.isRead ? 'text-[#143A30] dark:text-[#D4B483]' : ''
                                }`}
                              >
                                {msg.isRead ? (
                                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                <span>
                                  {msg.isRead
                                    ? t.messagesExtra.readStatus
                                    : t.messagesExtra.sentStatus}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Composer */}
                  <form
                    onSubmit={(e) => void handleSend(e)}
                    className="border-t border-[#E5E4E0] p-4 dark:border-[#2C2C2C]"
                  >
                    {attachedImageUrl && (
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-2 dark:border-[#343434] dark:bg-[#141414]">
                        <div className="flex items-center gap-2">
                          <img
                            src={attachedImageUrl}
                            alt={t.messagesExtra.photoAttached}
                            className="h-10 w-10 rounded-[8px] object-cover"
                          />
                          <span className="text-xs font-medium text-[#171717] dark:text-[#F5F5F5]">
                            {t.messagesExtra.photoAttached}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachedImageUrl('')}
                          className="text-xs text-[#991B1B] hover:underline dark:text-[#FCA5A5]"
                        >
                          {t.messagesExtra.removePhoto}
                        </button>
                      </div>
                    )}

                    {error && (
                      <p className="mb-2 text-xs text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
                    )}

                    <div className="flex items-end gap-2">
                      <label
                        title={t.messagesExtra.attachPhoto}
                        className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                      >
                        <Paperclip className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">{t.messagesExtra.attachPhoto}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void handleAttachPhoto(e)}
                          disabled={uploadingPhoto}
                          className="sr-only"
                        />
                      </label>

                      <input
                        type="text"
                        aria-label={t.messagesExtra.replyPlaceholder}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder={
                          uploadingPhoto
                            ? t.messagesExtra.uploadingPhoto
                            : t.messagesExtra.replyPlaceholder
                        }
                        className="min-h-[44px] flex-1 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                      />

                      <button
                        type="submit"
                        disabled={sending || uploadingPhoto}
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[14px] bg-[#143A30] px-4 text-sm font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
                      >
                        <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                        <span className="hidden sm:inline">
                          {sending ? t.messages.sending : t.messagesExtra.sendReply}
                        </span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label={t.common.close}
            className="absolute top-5 end-5 inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={lightboxImage}
            alt={t.messagesExtra.photoCaption}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-[16px] object-contain"
          />
        </div>
      )}
    </div>
  );
}
