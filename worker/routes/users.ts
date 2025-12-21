import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import type { Env } from '../../worker-configuration';

type Variables = {
  db: any;
  currencyService: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get current user profile
app.get('/me', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// Create or update user profile
app.post(
  '/sync',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      displayName: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      emailVerified: z.boolean().optional(),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const db = c.get('db');
    const data = c.req.valid('json');

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      return c.json({ user: updatedUser });
    } else {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          ...data,
        })
        .returning();

      return c.json({ user: newUser }, 201);
    }
  }
);

// Update user settings
app.patch(
  '/settings',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      baseCurrency: z.enum(['KZT', 'USD', 'EUR', 'BTC']).optional(),
      displayName: z.string().optional(),
      photoUrl: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const db = c.get('db');
    const data = c.req.valid('json');

    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: updatedUser });
  }
);

// Delete user account
app.delete('/me', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');

  await db.delete(users).where(eq(users.id, userId));

  return c.json({ success: true });
});

export default app;
