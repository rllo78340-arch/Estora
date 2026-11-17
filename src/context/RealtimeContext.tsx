import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import { apiFetch } from '../lib/api';
import type { MessageRecord, NotificationRecord, NotificationType, SellerReviewRecord } from '../types/estora';

export interface RealtimeIncomingEvent {
  type: 'auth:ok' | 'message:created' | 'message:read' | 'notification:created' | 'review:updated';
  payload?: unknown;
}

type RealtimeListener = (event: RealtimeIncomingEvent) => void;

interface RealtimeContextValue {
  notifications: NotificationRecord[];
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  toastNotification: NotificationRecord | null;
  dismissToast: () => void;
  refreshNotifications: () => Promise<void>;
  refreshUnreadMessages: () => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  subscribeRealtime: (listener: RealtimeListener) => () => void;
  onNavigateCallbackRef: { current: ((path: string) => void) | null };
}

const RealtimeContext = createContext<RealtimeContextValue>({
  notifications: [],
  unreadNotificationsCount: 0,
  unreadMessagesCount: 0,
  toastNotification: null,
  dismissToast: () => {},
  refreshNotifications: async () => {},
  refreshUnreadMessages: async () => {},
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
  subscribeRealtime: () => () => {},
  onNavigateCallbackRef: { current: null },
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { idToken, dbUser } = useAuth();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<NotificationRecord | null>(null);
  const listenersRef = useRef<Set<RealtimeListener>>(new Set());
  const onNavigateCallbackRef = useRef<((path: string) => void) | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    setToastNotification(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showLiveToast = useCallback((notif: NotificationRecord) => {
    setToastNotification(notif);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastNotification(null);
      toastTimerRef.current = null;
    }, 6500);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!idToken) {
      setNotifications([]);
      return;
    }
    try {
      const res = await apiFetch<{ notifications: NotificationRecord[] }>('/api/notifications', {
        token: idToken,
      });
      setNotifications(res.notifications);
    } catch {
      // ignore transient fetch issues
    }
  }, [idToken]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!idToken || !dbUser) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const res = await apiFetch<{ messages: MessageRecord[] }>('/api/messages', {
        token: idToken,
      });
      const unread = res.messages.filter((m) => m.recipientId === dbUser.id && !m.isRead).length;
      setUnreadMessagesCount(unread);
    } catch {
      // ignore transient fetch issues
    }
  }, [idToken, dbUser]);

  useEffect(() => {
    if (!idToken || !dbUser) {
      setNotifications([]);
      setUnreadMessagesCount(0);
      setToastNotification(null);
      return;
    }
    void refreshNotifications();
    void refreshUnreadMessages();
  }, [idToken, dbUser, refreshNotifications, refreshUnreadMessages]);

  useEffect(() => {
    if (!idToken || !dbUser || typeof window === 'undefined') return;

    let closedIntentionally = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let retryDelayMs = 2000;

    const connect = () => {
      if (closedIntentionally) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        retryDelayMs = 2000;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'auth', token: idToken }));
        }
        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as RealtimeIncomingEvent;
          if (!parsed || typeof parsed.type !== 'string') return;

          if (parsed.type === 'notification:created' && parsed.payload) {
            const notif = parsed.payload as NotificationRecord;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) return prev;
              return [notif, ...prev].slice(0, 50);
            });
            showLiveToast(notif);
          } else if (parsed.type === 'message:created' && parsed.payload) {
            const msg = parsed.payload as MessageRecord;
            if (msg.recipientId === dbUser.id && !msg.isRead) {
              setUnreadMessagesCount((c) => c + 1);
            }
          } else if (parsed.type === 'message:read' && parsed.payload) {
            const info = parsed.payload as { readerId?: number; messageIds?: number[] };
            if (info.readerId === dbUser.id && Array.isArray(info.messageIds)) {
              setUnreadMessagesCount((c) => Math.max(0, c - info.messageIds!.length));
            }
          } else if (parsed.type === 'review:updated' && parsed.payload) {
            // Forward to listeners (PropertyDetailModal / ProfilePage)
            void (parsed.payload as { sellerId: number; review: SellerReviewRecord });
          }

          for (const listener of listenersRef.current) {
            listener(parsed);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (pingTimer) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!closedIntentionally) {
          reconnectTimer = window.setTimeout(() => {
            retryDelayMs = Math.min(12000, retryDelayMs * 1.5);
            connect();
          }, retryDelayMs);
        }
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, [idToken, dbUser, showLiveToast]);

  const markNotificationRead = useCallback(
    async (id: number) => {
      if (!idToken) return;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH', token: idToken });
      } catch {
        // fallback reload
        void refreshNotifications();
      }
    },
    [idToken, refreshNotifications]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!idToken) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH', token: idToken });
    } catch {
      void refreshNotifications();
    }
  }, [idToken, refreshNotifications]);

  const subscribeRealtime = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const toastTypeLabel = toastNotification
    ? t.notifications.types[toastNotification.type as NotificationType] ?? toastNotification.type
    : '';

  return (
    <RealtimeContext.Provider
      value={{
        notifications,
        unreadNotificationsCount,
        unreadMessagesCount,
        toastNotification,
        dismissToast,
        refreshNotifications,
        refreshUnreadMessages,
        markNotificationRead,
        markAllNotificationsRead,
        subscribeRealtime,
        onNavigateCallbackRef,
      }}
    >
      {children}

      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 end-5 z-50 w-full max-w-sm rounded-[18px] border border-[#E5E4E0] bg-white p-4 shadow-xl transition-all dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#143A30] text-white">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#8C6D46] dark:text-[#D4B483]">
                {toastTypeLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  const link = toastNotification.linkPath || '/profile?tab=notifications';
                  void markNotificationRead(toastNotification.id);
                  dismissToast();
                  onNavigateCallbackRef.current?.(link);
                }}
                className="mt-0.5 block w-full text-start"
              >
                <p className="truncate text-sm font-semibold text-[#171717] hover:underline dark:text-[#F5F5F5]">
                  {toastNotification.title}
                </p>
                {toastNotification.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
                    {toastNotification.body}
                  </p>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              aria-label={t.common.close}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-[#737373] hover:bg-[#F8F8F7] dark:text-[#A0A0A0] dark:hover:bg-[#242424]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
