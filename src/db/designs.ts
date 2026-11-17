import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { userDesigns } from './schema.ts';

export async function listUserDesigns(userId: number) {
  const rows = await db
    .select()
    .from(userDesigns)
    .where(eq(userDesigns.userId, userId))
    .orderBy(desc(userDesigns.updatedAt));

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getUserDesignById(id: number, userId: number, isAdmin: boolean) {
  const rows = await db
    .select()
    .from(userDesigns)
    .where(eq(userDesigns.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!isAdmin && row.userId !== userId) return null;

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createUserDesign(input: {
  userId: number;
  propertyId?: number | null;
  title: string;
  designJson: string;
  thumbnailUrl?: string;
}) {
  const inserted = await db
    .insert(userDesigns)
    .values({
      userId: input.userId,
      propertyId: input.propertyId ?? null,
      title: input.title.trim() || 'Мой дизайн интерьера',
      designJson: input.designJson || '{}',
      thumbnailUrl: input.thumbnailUrl || '',
    })
    .returning();

  const r = inserted[0];
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function updateUserDesign(
  id: number,
  userId: number,
  isAdmin: boolean,
  patch: {
    title?: string;
    designJson?: string;
    thumbnailUrl?: string;
  }
) {
  const existing = await getUserDesignById(id, userId, isAdmin);
  if (!existing) return null;

  const updated = await db
    .update(userDesigns)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.designJson !== undefined ? { designJson: patch.designJson } : {}),
      ...(patch.thumbnailUrl !== undefined ? { thumbnailUrl: patch.thumbnailUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(userDesigns.id, id))
    .returning();

  const r = updated[0];
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function deleteUserDesign(id: number, userId: number, isAdmin: boolean) {
  const existing = await getUserDesignById(id, userId, isAdmin);
  if (!existing) return null;

  await db.delete(userDesigns).where(eq(userDesigns.id, id));
  return existing;
}
