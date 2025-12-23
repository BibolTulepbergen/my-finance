import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Firebase UID
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  baseCurrency: text('base_currency').notNull().default('USD'), // KZT, USD, EUR, BTC
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Accounts table (wallet, savings, crypto wallet, bank account)
// Места хранения денег: кошелек, копилка, счет в банке, крипто-кошелек
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Название места хранения
  type: text('type').notNull(), // wallet, savings, bank, crypto
  currency: text('currency').notNull(), // KZT, USD, EUR, BTC
  balance: real('balance').notNull().default(0),
  balanceInBaseCurrency: real('balance_in_base_currency'), // Баланс в основной валюте пользователя
  description: text('description'),
  icon: text('icon'), // Иконка
  color: text('color'), // Цвет для UI
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Transactions table
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // income, expense, transfer
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  fromAccountId: text('from_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  toAccountId: text('to_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  fromAmount: real('from_amount'),
  toAmount: real('to_amount'),
  exchangeRate: real('exchange_rate'),
  category: text('category'),
  description: text('description'),
  notes: text('notes'),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // income, expense
  icon: text('icon'),
  color: text('color'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Budgets table
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  period: text('period').notNull(), // daily, weekly, monthly, yearly
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Exchange rates table - оптимизированная таблица курсов валют
// Хранит только базовые курсы относительно USD (USD-EUR, USD-KZT, USD-BTC)
// Кросс-курсы вычисляются автоматически в CurrencyService
export const exchangeRates = sqliteTable('exchange_rates', {
  id: text('id').primaryKey(), // Формат: "USD-EUR", "USD-KZT", "USD-BTC"
  fromCurrency: text('from_currency').notNull(), // Всегда USD для базовых курсов
  toCurrency: text('to_currency').notNull(), // EUR, KZT, BTC
  rate: real('rate').notNull(),
  source: text('source').notNull().default('yahoo-finance'), // Источник данных
  lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  uniquePair: unique().on(table.fromCurrency, table.toCurrency),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
