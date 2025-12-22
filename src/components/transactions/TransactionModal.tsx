import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  TrendingDown,
  TrendingUp,
  SwapHoriz,
} from '@mui/icons-material';
import { transactionApi } from '../../lib/api';
import type { 
  CreateExpenseInput, 
  CreateIncomeInput, 
  CreateTransferInput,
  Account 
} from '../../lib/types';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: Account[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ 
  open,
  onClose, 
  onSuccess, 
  accounts 
}) => {
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  // For income/expense
  const [accountId, setAccountId] = useState('');

  // For transfer
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const typeIndex = type === 'expense' ? 0 : type === 'income' ? 1 : 2;

  const handleTabChange = (_: any, newValue: number) => {
    const newType = newValue === 0 ? 'expense' : newValue === 1 ? 'income' : 'transfer';
    setType(newType);
    setError(null);
    // Clear fields when switching types
    setAmount('');
    setDescription('');
    setCategory('');
    setAccountId('');
    setFromAccountId('');
    setToAccountId('');
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setType('expense');
      setAmount('');
      setDescription('');
      setCategory('');
      setAccountId('');
      setFromAccountId('');
      setToAccountId('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (type === 'expense') {
        const data: CreateExpenseInput = {
          accountId,
          amount: parseFloat(amount),
          currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
          category: category || undefined,
          description: description || undefined,
        };
        await transactionApi.createExpense(data);
      } else if (type === 'income') {
        const data: CreateIncomeInput = {
          accountId,
          amount: parseFloat(amount),
          currency: accounts.find(a => a.id === accountId)?.currency || 'USD',
          category: category || undefined,
          description: description || undefined,
        };
        await transactionApi.createIncome(data);
      } else if (type === 'transfer') {
        const data: CreateTransferInput = {
          fromAccountId,
          toAccountId,
          fromAmount: parseFloat(amount),
          description: description || undefined,
        };
        await transactionApi.createTransfer(data);
      }

      // Reset form
      setAmount('');
      setDescription('');
      setCategory('');
      setAccountId('');
      setFromAccountId('');
      setToAccountId('');

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания транзакции');
    } finally {
      setLoading(false);
    }
  };

  const getCurrency = (id: string) => {
    return accounts.find(a => a.id === id)?.currency || '';
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Новая транзакция</DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Tabs value={typeIndex} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab 
              icon={<TrendingDown />} 
              label="Расход" 
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<TrendingUp />} 
              label="Доход" 
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab 
              icon={<SwapHoriz />} 
              label="Перевод" 
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          </Tabs>

          {type !== 'transfer' ? (
            <TextField
              select
              label="Счет"
              fullWidth
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              margin="normal"
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <>
              <TextField
                select
                label="Откуда"
                fullWidth
                required
                value={fromAccountId}
                onChange={(e) => {
                  const newFromId = e.target.value;
                  setFromAccountId(newFromId);
                  // Reset toAccountId if it's no longer valid (different currency or same account)
                  if (toAccountId) {
                    const fromAcc = accounts.find(a => a.id === newFromId);
                    const toAcc = accounts.find(a => a.id === toAccountId);
                    if (toAccountId === newFromId || fromAcc?.currency !== toAcc?.currency) {
                      setToAccountId('');
                    }
                  }
                }}
                margin="normal"
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Куда"
                fullWidth
                required
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                margin="normal"
                disabled={!fromAccountId}
                helperText={!fromAccountId ? 'Сначала выберите счет списания' : 'Только счета с той же валютой'}
              >
                {accounts
                  .filter(a => {
                    if (!fromAccountId) return false;
                    if (a.id === fromAccountId) return false;
                    const fromAccount = accounts.find(acc => acc.id === fromAccountId);
                    return a.currency === fromAccount?.currency;
                  })
                  .map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </MenuItem>
                  ))}
              </TextField>
            </>
          )}

          <TextField
            label="Сумма"
            type="number"
            fullWidth
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            margin="normal"
            inputProps={{ step: '0.01', min: '0.01' }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {type !== 'transfer' 
                    ? getCurrency(accountId)
                    : getCurrency(fromAccountId)
                  }
                </InputAdornment>
              ),
            }}
          />

          {type !== 'transfer' && (
            <TextField
              label="Категория"
              fullWidth
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              margin="normal"
              placeholder="Например: Еда, Зарплата"
            />
          )}

          <TextField
            label="Описание"
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            placeholder="Комментарий к транзакции"
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Отмена
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading}
            color={type === 'expense' ? 'error' : type === 'income' ? 'success' : 'primary'}
          >
            {loading ? <CircularProgress size={24} /> : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
