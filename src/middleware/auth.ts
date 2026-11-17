import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
  preferredCity: string;
  preferredCurrency: string;
  notificationsEnabled: boolean;
  isBlocked: boolean;
  blockedReason: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
}

export async function verifyFirebaseTokenToDbUser(token: string): Promise<{
  decodedToken: DecodedIdToken;
  dbUser: DbUser;
}> {
  const decodedToken = await adminAuth.verifyIdToken(token);
  const email = decodedToken.email || `${decodedToken.uid}@estora.uz`;
  const displayName = typeof decodedToken.name === 'string' ? decodedToken.name : undefined;
  const dbUser = await getOrCreateUser(decodedToken.uid, email, displayName);
  return { decodedToken, dbUser };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация для выполнения этого действия.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { decodedToken, dbUser } = await verifyFirebaseTokenToDbUser(token);
    if (dbUser.isBlocked) {
      return res.status(403).json({
        error: dbUser.blockedReason
          ? `Аккаунт заблокирован администратором: ${dbUser.blockedReason}`
          : 'Ваш аккаунт заблокирован администратором платформы ESTORA.',
      });
    }
    req.user = decodedToken;
    req.dbUser = dbUser;

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Сессия недействительна или истекла. Войдите снова.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Требуется авторизация.' });
  }
  if (req.dbUser.role !== 'admin') {
    return res.status(403).json({
      error: 'Доступ запрещён. Этот раздел доступен только администраторам ESTORA.',
    });
  }
  next();
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { decodedToken, dbUser } = await verifyFirebaseTokenToDbUser(token);
    req.user = decodedToken;
    req.dbUser = dbUser;
  } catch {
    // Ignore invalid optional tokens on public read routes
  }
  next();
};
