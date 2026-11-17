import type http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyFirebaseTokenToDbUser } from '../middleware/auth.ts';

export type RealtimeEventType =
  | 'auth:ok'
  | 'message:created'
  | 'message:read'
  | 'notification:created'
  | 'review:updated';

export interface RealtimeBroadcastEvent {
  type: RealtimeEventType;
  payload: unknown;
}

class EstoraRealtimeHub {
  private wss: WebSocketServer | null = null;
  private socketsByUser = new Map<number, Set<WebSocket>>();
  private userBySocket = new WeakMap<WebSocket, number>();

  attach(server: http.Server) {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (socket) => {
      let authenticated = false;

      const authTimer = setTimeout(() => {
        if (!authenticated && socket.readyState === WebSocket.OPEN) {
          socket.close(4001, 'Auth timeout');
        }
      }, 10000);

      socket.on('message', async (raw) => {
        try {
          const text = raw.toString();
          const parsed = JSON.parse(text) as { type?: string; token?: string };
          if (parsed.type === 'ping') {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'pong' }));
            }
            return;
          }
          if (parsed.type === 'auth' && typeof parsed.token === 'string' && parsed.token.trim()) {
            const { dbUser } = await verifyFirebaseTokenToDbUser(parsed.token.trim());
            authenticated = true;
            clearTimeout(authTimer);

            const previousUserId = this.userBySocket.get(socket);
            if (previousUserId && previousUserId !== dbUser.id) {
              this.socketsByUser.get(previousUserId)?.delete(socket);
            }

            let set = this.socketsByUser.get(dbUser.id);
            if (!set) {
              set = new Set<WebSocket>();
              this.socketsByUser.set(dbUser.id, set);
            }
            set.add(socket);
            this.userBySocket.set(socket, dbUser.id);

            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: 'auth:ok',
                  payload: { userId: dbUser.id },
                })
              );
            }
          }
        } catch {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'auth:error' }));
          }
        }
      });

      socket.on('close', () => {
        clearTimeout(authTimer);
        const userId = this.userBySocket.get(socket);
        if (userId) {
          const set = this.socketsByUser.get(userId);
          set?.delete(socket);
          if (set && set.size === 0) {
            this.socketsByUser.delete(userId);
          }
        }
      });
    });
  }

  emitToUser(userId: number, event: RealtimeBroadcastEvent) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets || sockets.size === 0) return;
    const serialized = JSON.stringify(event);
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(serialized);
      }
    }
  }

  emitToUsers(userIds: number[], event: RealtimeBroadcastEvent) {
    const unique = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
    for (const uid of unique) {
      this.emitToUser(uid, event);
    }
  }
}

export const realtimeHub = new EstoraRealtimeHub();
