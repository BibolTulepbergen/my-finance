import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { transactions, accounts } from '../db/schema';
import { authMiddleware, getUserId } from '../middleware/auth';
import { nanoid } from 'nanoid';
import type { Env } from '../../worker-configuration';

type Variables = {
  db: any;
  currencyService: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Validation schemas
const createExpenseSchema = z.object({
  accountId: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

const createIncomeSchema = z.object({
  accountId: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

const createTransferSchema = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  fromAmount: z.number().positive(),
  description: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

const updateTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  fromAmount: z.number().positive().optional(),
  toAmount: z.number().positive().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
});

// Get all transactions for current user with filters
app.get('/', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');

  // Query parameters for filtering
  const type = c.req.query('type'); // income, expense, transfer
  const accountId = c.req.query('accountId');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  // Apply filters
  const conditions = [eq(transactions.userId, userId)];

  if (type) {
    conditions.push(eq(transactions.type, type));
  }

  if (accountId) {
    conditions.push(
      sql`(${transactions.accountId} = ${accountId} OR ${transactions.fromAccountId} = ${accountId} OR ${transactions.toAccountId} = ${accountId})`
    );
  }

  if (startDate) {
    conditions.push(gte(transactions.date, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(transactions.date, new Date(endDate)));
  }

  query = query.where(and(...conditions)).limit(limit).offset(offset);

  const userTransactions = await query.all();

  return c.json({ transactions: userTransactions, count: userTransactions.length });
});

// Get single transaction
app.get('/:id', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const transactionId = c.req.param('id');
  const db = c.get('db');

  const transaction = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .get();

  if (!transaction) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  return c.json({ transaction });
});

// Create expense transaction
app.post('/expense', authMiddleware, zValidator('json', createExpenseSchema), async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');
  const data = c.req.valid('json');

  // Verify account belongs to user
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
    .get();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  // Create transaction
  const [newTransaction] = await db
    .insert(transactions)
    .values({
      id: nanoid(),
      userId,
      type: 'expense',
      accountId: data.accountId,
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      description: data.description,
      notes: data.notes,
      date: data.date ? new Date(data.date) : new Date(),
    })
    .returning();

  // Update account balance
  await db
    .update(accounts)
    .set({
      balance: sql`${accounts.balance} - ${data.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, data.accountId));

  return c.json({ transaction: newTransaction }, 201);
});

// Create income transaction
app.post('/income', authMiddleware, zValidator('json', createIncomeSchema), async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');
  const data = c.req.valid('json');

  // Verify account belongs to user
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, userId)))
    .get();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  // Create transaction
  const [newTransaction] = await db
    .insert(transactions)
    .values({
      id: nanoid(),
      userId,
      type: 'income',
      accountId: data.accountId,
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      description: data.description,
      notes: data.notes,
      date: data.date ? new Date(data.date) : new Date(),
    })
    .returning();

  // Update account balance
  await db
    .update(accounts)
    .set({
      balance: sql`${accounts.balance} + ${data.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, data.accountId));

  return c.json({ transaction: newTransaction }, 201);
});

// Create transfer transaction
app.post('/transfer', authMiddleware, zValidator('json', createTransferSchema), async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');
  const data = c.req.valid('json');

  // Verify both accounts belong to user
  const [fromAccount, toAccount] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, data.fromAccountId), eq(accounts.userId, userId)))
      .get(),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, data.toAccountId), eq(accounts.userId, userId)))
      .get(),
  ]);

  if (!fromAccount) {
    return c.json({ error: 'Source account not found' }, 404);
  }

  if (!toAccount) {
    return c.json({ error: 'Destination account not found' }, 404);
  }

  if (fromAccount.id === toAccount.id) {
    return c.json({ error: 'Cannot transfer to the same account' }, 400);
  }

  // Check if currencies match - transfers only allowed within same currency
  if (fromAccount.currency !== toAccount.currency) {
    return c.json({ 
      error: 'Переводы возможны только между счетами с одинаковой валютой' 
    }, 400);
  }

  // Check if source account has sufficient balance
  if (fromAccount.balance < data.fromAmount) {
    return c.json({ error: 'Insufficient balance' }, 400);
  }

  // Same currency - amount is the same
  const toAmount = data.fromAmount;
  const exchangeRate = 1;

  // Create transaction
  const [newTransaction] = await db
    .insert(transactions)
    .values({
      id: nanoid(),
      userId,
      type: 'transfer',
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.fromAmount,
      currency: fromAccount.currency,
      fromAmount: data.fromAmount,
      toAmount,
      exchangeRate,
      description: data.description,
      notes: data.notes,
      date: data.date ? new Date(data.date) : new Date(),
    })
    .returning();

  // Update both account balances
  await Promise.all([
    db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} - ${data.fromAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, data.fromAccountId)),
    db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} + ${toAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, data.toAccountId)),
  ]);

  return c.json({ transaction: newTransaction }, 201);
});

// Update transaction
app.patch('/:id', authMiddleware, zValidator('json', updateTransactionSchema), async (c) => {
  const userId = getUserId(c);
  const transactionId = c.req.param('id');
  const db = c.get('db');
  const data = c.req.valid('json');

  // Get existing transaction
  const existingTransaction = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .get();

  if (!existingTransaction) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  // If amount is being changed, we need to update account balances
  if (data.amount && data.amount !== existingTransaction.amount) {
    const difference = data.amount - existingTransaction.amount;

    if (existingTransaction.type === 'expense') {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${difference}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existingTransaction.accountId!));
    } else if (existingTransaction.type === 'income') {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${difference}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existingTransaction.accountId!));
    }
  }

  // Update transaction
  const [updatedTransaction] = await db
    .update(transactions)
    .set({
      ...data,
      date: data.date ? new Date(data.date) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .returning();

  return c.json({ transaction: updatedTransaction });
});

// Delete transaction
app.delete('/:id', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const transactionId = c.req.param('id');
  const db = c.get('db');

  // Get transaction to reverse account changes
  const transaction = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .get();

  if (!transaction) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  // Reverse account balance changes
  if (transaction.type === 'expense' && transaction.accountId) {
    await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} + ${transaction.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, transaction.accountId));
  } else if (transaction.type === 'income' && transaction.accountId) {
    await db
      .update(accounts)
      .set({
        balance: sql`${accounts.balance} - ${transaction.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, transaction.accountId));
  } else if (transaction.type === 'transfer') {
    // Reverse transfer
    if (transaction.fromAccountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} + ${transaction.fromAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, transaction.fromAccountId));
    }
    if (transaction.toAccountId) {
      await db
        .update(accounts)
        .set({
          balance: sql`${accounts.balance} - ${transaction.toAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, transaction.toAccountId));
    }
  }

  // Delete transaction
  await db.delete(transactions).where(eq(transactions.id, transactionId));

  return c.json({ success: true });
});

// Get transaction statistics
app.get('/stats/summary', authMiddleware, async (c) => {
  const userId = getUserId(c);
  const db = c.get('db');

  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const conditions = [eq(transactions.userId, userId)];

  if (startDate) {
    conditions.push(gte(transactions.date, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(transactions.date, new Date(endDate)));
  }

  // Get income and expense totals
  const stats = await db
    .select({
      type: transactions.type,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.type)
    .all();

  const income = stats.find((s: { type: string }) => s.type === 'income');
  const expense = stats.find((s: { type: string }) => s.type === 'expense');
  const transfer = stats.find((s: { type: string }) => s.type === 'transfer');

  return c.json({
    income: {
      total: income?.total || 0,
      count: income?.count || 0,
    },
    expense: {
      total: expense?.total || 0,
      count: expense?.count || 0,
    },
    transfer: {
      total: transfer?.total || 0,
      count: transfer?.count || 0,
    },
    balance: (income?.total || 0) - (expense?.total || 0),
  });
});

export default app;
