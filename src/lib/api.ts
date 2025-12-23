import { auth } from '../config/firebase';
import type {
  User,
  Account,
  Transaction,
  CreateExpenseInput,
  CreateIncomeInput,
  CreateTransferInput,
  UpdateTransactionInput,
  TransactionFilters,
  TransactionStats,
} from './types';

const API_BASE_URL = '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Generic API call
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// User API
export const userApi = {
  getMe: () => apiCall<{ user: User }>('/users/me'),
  
  updateSettings: (data: {
    baseCurrency?: string;
    displayName?: string;
    photoUrl?: string;
  }) => apiCall<{ user: User }>('/users/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  deleteAccount: () => apiCall<{ success: boolean }>('/users/me', {
    method: 'DELETE',
  }),
};

// Account API
export const accountApi = {
  getAll: () => apiCall<{ accounts: Account[] }>('/accounts'),
  
  getOne: (id: string) => apiCall<{ account: Account }>(`/accounts/${id}`),
  
  create: (data: {
    name: string;
    type: 'wallet' | 'savings' | 'crypto' | 'bank';
    currency: string;
    initialBalance?: number;
    description?: string;
    icon?: string;
    color?: string;
  }) => apiCall<{ account: Account }>('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: string, data: Partial<{
    name: string;
    type: string;
    description: string;
    icon: string;
    color: string;
    isActive: boolean;
  }>) => apiCall<{ account: Account }>(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (id: string) => apiCall<{ success: boolean }>(`/accounts/${id}`, {
    method: 'DELETE',
  }),

  archive: (id: string) => apiCall<{ account: Account }>(`/accounts/${id}/archive`, {
    method: 'POST',
  }),

  restore: (id: string) => apiCall<{ account: Account }>(`/accounts/${id}/restore`, {
    method: 'POST',
  }),
  
  getSummary: () => apiCall<{
    baseCurrency: string;
    totalBalance: number;
    accounts: Account[];
  }>('/accounts/balances/summary'),

  recalculateBalance: (id: string) => apiCall<{
    account: Account;
    calculation: {
      income: number;
      expense: number;
      transfersOut: number;
      transfersIn: number;
      balance: number;
    };
  }>(`/accounts/recalculate/${id}`, {
    method: 'POST',
  }),
};

// Currency API
export const currencyApi = {
  getRate: (from: string, to: string) => 
    apiCall<{ from: string; to: string; rate: number }>(
      `/currency/rate?from=${from}&to=${to}`
    ),
  
  getRates: (base: string, targets: string[]) =>
    apiCall<{ base: string; rates: Record<string, number> }>(
      `/currency/rates?base=${base}&targets=${targets.join(',')}`
    ),
  
  convert: (amount: number, from: string, to: string) =>
    apiCall<{
      originalAmount: number;
      convertedAmount: number;
      from: string;
      to: string;
      rate: number;
    }>('/currency/convert', {
      method: 'POST',
      body: JSON.stringify({ amount, from, to }),
    }),
};

// Transaction API
export const transactionApi = {
  getAll: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.accountId) params.append('accountId', filters.accountId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    const queryString = params.toString();
    return apiCall<{ transactions: Transaction[]; count: number }>(
      `/transactions${queryString ? `?${queryString}` : ''}`
    );
  },
  
  getOne: (id: string) => apiCall<{ transaction: Transaction }>(`/transactions/${id}`),
  
  createExpense: (data: CreateExpenseInput) =>
    apiCall<{ transaction: Transaction }>('/transactions/expense', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  createIncome: (data: CreateIncomeInput) =>
    apiCall<{ transaction: Transaction }>('/transactions/income', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  createTransfer: (data: CreateTransferInput) =>
    apiCall<{ transaction: Transaction }>('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: UpdateTransactionInput) =>
    apiCall<{ transaction: Transaction }>(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    apiCall<{ success: boolean }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),
  
  getStats: (filters?: { startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const queryString = params.toString();
    return apiCall<TransactionStats>(
      `/transactions/stats/summary${queryString ? `?${queryString}` : ''}`
    );
  },
};
