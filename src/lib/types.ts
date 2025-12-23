// User types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  baseCurrency: 'KZT' | 'USD' | 'EUR' | 'BTC';
  createdAt: Date;
  updatedAt: Date;
}

// Account types
export type AccountType = 'wallet' | 'savings' | 'crypto' | 'bank';
export type Currency = 'KZT' | 'USD' | 'EUR' | 'BTC';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  balanceInBaseCurrency?: number;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction types
export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  accountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
  currency: string;
  fromAmount?: number;
  toAmount?: number;
  exchangeRate?: number;
  category?: string;
  description?: string;
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction creation types
export interface CreateExpenseInput {
  accountId: string;
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  notes?: string;
  date?: string;
}

export interface CreateIncomeInput {
  accountId: string;
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  notes?: string;
  date?: string;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  fromAmount: number;
  description?: string;
  notes?: string;
  date?: string;
}

export interface UpdateTransactionInput {
  amount?: number;
  fromAmount?: number;
  toAmount?: number;
  category?: string;
  description?: string;
  notes?: string;
  date?: string;
}

// Transaction filters
export interface TransactionFilters {
  type?: TransactionType;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Transaction statistics
export interface TransactionStats {
  income: {
    total: number;
    count: number;
  };
  expense: {
    total: number;
    count: number;
  };
  transfer: {
    total: number;
    count: number;
  };
  balance: number;
}

// Category types
export interface Category {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// Budget types
export interface Budget {
  id: string;
  userId: string;
  categoryId?: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Exchange rate types
export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  lastUpdated: Date;
}
