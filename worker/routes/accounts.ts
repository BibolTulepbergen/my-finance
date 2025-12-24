import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { accounts, users, transactions } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { nanoid } from 'nanoid';
import type { Env } from '../../worker-configuration';

type Variables = {
  db: any;
  currencyService: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get all accounts for current user
app.get('/', authMiddleware, async (c) => {
  try {
    const userId = getUserId(c);
    const db = c.get('db');

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.sortOrder, accounts.createdAt)
      .all();

    return c.json({ accounts: userAccounts });
  } catch (error) {
    console.error('Error in /accounts:', error);
    return c.json({ error: 'Failed to fetch accounts' }, 500);
  }
});

// Get single account
app.get('/:id', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const accountId = c.req.param('id');
  const db = c.get('db');

  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .get();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({ account });
});

// Create new account
app.post(
  '/',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      type: z.enum(['wallet', 'savings', 'crypto', 'bank']),
      currency: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      initialBalance: z.number().optional().default(0),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      sortOrder: z.number().optional().default(0),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const db = c.get('db');
    const data = c.req.valid('json');
    const { initialBalance, ...accountData } = data;

    // Create account with zero balance
    const accountId = nanoid();
    const [newAccount] = await db
      .insert(accounts)
      .values({
        id: accountId,
        userId,
        ...accountData,
        balance: 0, // Always start with 0
      })
      .returning();

    // If initial balance is provided and > 0, create an income transaction
    if (initialBalance && initialBalance > 0) {
      await db
        .insert(transactions)
        .values({
          id: nanoid(),
          userId,
          type: 'income',
          accountId,
          amount: initialBalance,
          currency: data.currency,
          description: 'Начальный баланс',
          date: new Date(),
        });

      // Update account balance
      await db
        .update(accounts)
        .set({
          balance: initialBalance,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId));

      // Refresh account data
      const [updatedAccount] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      return c.json({ account: updatedAccount }, 201);
    }

    return c.json({ account: newAccount }, 201);
  }
);

// Update account (balance cannot be updated manually)
app.patch(
  '/:id',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['wallet', 'savings', 'crypto', 'bank']).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    })
  ),
  async (c) => {
    const userId = getUserId(c);
    const accountId = c.req.param('id');
    const db = c.get('db');
    const data = c.req.valid('json');

    // If trying to archive (set isActive to false), check balance
    if (data.isActive === false) {
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
        .get();

      if (!account) {
        return c.json({ error: 'Account not found' }, 404);
      }

      if (account.balance !== 0) {
        return c.json({ 
          error: 'Нельзя архивировать счет с ненулевым балансом. Переведите или потратьте средства.' 
        }, 400);
      }
    }

    const [updatedAccount] = await db
      .update(accounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .returning();

    if (!updatedAccount) {
      return c.json({ error: 'Account not found' }, 404);
    }

    return c.json({ account: updatedAccount });
  }
);

// Archive/Unarchive account - alias for PATCH with isActive
app.post('/:id/archive', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const accountId = c.req.param('id');
  const db = c.get('db');

  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .get();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  if (account.balance !== 0) {
    return c.json({ 
      error: 'Нельзя архивировать счет с ненулевым балансом. Переведите или потратьте средства.' 
    }, 400);
  }

  const [updatedAccount] = await db
    .update(accounts)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId))
    .returning();

  return c.json({ account: updatedAccount });
});

// Restore account from archive
app.post('/:id/restore', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const accountId = c.req.param('id');
  const db = c.get('db');

  const [updatedAccount] = await db
    .update(accounts)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .returning();

  if (!updatedAccount) {
    return c.json({ error: 'Account not found' }, 404);
  }

  return c.json({ account: updatedAccount });
});

// Get account balances in all currencies
app.get('/balances/summary', authMiddleware, async (c) => {
  try {
    const userId = getUserId(c);
    const db = c.get('db');
    const currencyService = c.get('currencyService');

    // Get user's base currency
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    const baseCurrency = user?.baseCurrency || 'USD';

    // Get all accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
      .all();

    // Calculate total in base currency
    let totalInBaseCurrency = 0;
    const accountsWithConvertedBalance = await Promise.all(
      userAccounts.map(async (account: any) => {
        try {
          const convertedBalance = await currencyService.convert(
            account.balance,
            account.currency as any,
            baseCurrency as any
          );
          totalInBaseCurrency += convertedBalance;

          return {
            ...account,
            balanceInBaseCurrency: convertedBalance,
          };
        } catch (error) {
          console.error(`Failed to convert balance for account ${account.id}:`, error);
          // Fallback: use original balance if conversion fails
          totalInBaseCurrency += account.balance;
          return {
            ...account,
            balanceInBaseCurrency: account.balance,
          };
        }
      })
    );

    return c.json({
      baseCurrency,
      totalBalance: totalInBaseCurrency,
      accounts: accountsWithConvertedBalance,
    });
  } catch (error) {
    console.error('Error in /balances/summary:', error);
    return c.json({ error: 'Failed to fetch account balances' }, 500);
  }
});

// Recalculate account balance based on transactions
app.post('/recalculate/:id', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const accountId = c.req.param('id');
  const db = c.get('db');

  // Verify account belongs to user
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .get();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  // Calculate balance from transactions
  // Income transactions for this account
  const incomeResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accountId),
        eq(transactions.type, 'income')
      )
    )
    .get();

  // Expense transactions for this account
  const expenseResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accountId),
        eq(transactions.type, 'expense')
      )
    )
    .get();

  // Transfers OUT from this account
  const transfersOutResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.fromAmount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.fromAccountId, accountId),
        eq(transactions.type, 'transfer')
      )
    )
    .get();

  // Transfers IN to this account
  const transfersInResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.toAmount}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.toAccountId, accountId),
        eq(transactions.type, 'transfer')
      )
    )
    .get();

  const income = incomeResult?.total || 0;
  const expense = expenseResult?.total || 0;
  const transfersOut = transfersOutResult?.total || 0;
  const transfersIn = transfersInResult?.total || 0;

  const calculatedBalance = income - expense - transfersOut + transfersIn;

  // Update account balance
  const [updatedAccount] = await db
    .update(accounts)
    .set({
      balance: calculatedBalance,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId))
    .returning();

  return c.json({
    account: updatedAccount,
    calculation: {
      income,
      expense,
      transfersOut,
      transfersIn,
      balance: calculatedBalance,
    },
  });
});

export default app;
