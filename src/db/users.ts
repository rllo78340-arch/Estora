import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

const BOOTSTRAP_ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'rllo78340@gmail.com'
).toLowerCase();

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const isBootstrapAdmin = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL;

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing[0]) {
      const current = existing[0];
      const nextRole =
        isBootstrapAdmin && current.role !== 'admin' ? 'admin' : current.role;
      const rows = await db
        .update(users)
        .set({
          email,
          role: nextRole,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, uid))
        .returning();
      return rows[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        role: isBootstrapAdmin ? 'admin' : 'buyer',
        fullName:
          fullName && fullName.trim().length > 0
            ? fullName.trim()
            : email.split('@')[0] || 'ESTORA Member',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to sync user record:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to fetch user by UID:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    fullName?: string;
    phone?: string;
    preferredCity?: string;
    preferredCurrency?: string;
    notificationsEnabled?: boolean;
  }
) {
  try {
    const rows = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}
