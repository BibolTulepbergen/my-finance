import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  List,
  ListItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  TrendingUp,
  TrendingDown,
  SwapHoriz,
} from '@mui/icons-material';
import { transactionApi } from '../../lib/api';
import type { Transaction, TransactionFilters, Account } from '../../lib/types';

interface TransactionListProps {
  accounts: Account[];
  filters?: TransactionFilters;
  onTransactionDeleted?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  accounts, 
  filters,
  onTransactionDeleted 
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { transactions: data } = await transactionApi.getAll(filters);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить транзакцию?')) return;

    try {
      await transactionApi.delete(id);
      setTransactions(transactions.filter(t => t.id !== id));
      onTransactionDeleted?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const getAccountName = (accountId?: string) => {
    if (!accountId) return 'N/A';
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + ' ' + currency;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <TrendingUp sx={{ color: 'success.main' }} />;
      case 'expense':
        return <TrendingDown sx={{ color: 'error.main' }} />;
      case 'transfer':
        return <SwapHoriz sx={{ color: 'info.main' }} />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string): 'success' | 'error' | 'info' => {
    switch (type) {
      case 'income':
        return 'success';
      case 'expense':
        return 'error';
      case 'transfer':
        return 'info';
      default:
        return 'info';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Доход';
      case 'expense':
        return 'Расход';
      case 'transfer':
        return 'Перевод';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (transactions.length === 0) {
    return (
      <Alert severity="info">
        Транзакций не найдено
      </Alert>
    );
  }

  return (
    <List sx={{ p: 0 }}>
      {transactions.map((transaction) => (
        <ListItem 
          key={transaction.id}
          sx={{ 
            p: 0, 
            mb: 1,
            '&:last-child': { mb: 0 }
          }}
        >
          <Card sx={{ width: '100%' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box>
                  {getTypeIcon(transaction.type)}
                </Box>
                
                <Box flex={1} minWidth={0}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Chip 
                      label={getTypeLabel(transaction.type)}
                      size="small"
                      color={getTypeColor(transaction.type)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(transaction.date)}
                    </Typography>
                  </Box>

                  {transaction.type === 'transfer' ? (
                    <>
                      <Typography variant="body2" noWrap>
                        {getAccountName(transaction.fromAccountId)} → {getAccountName(transaction.toAccountId)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                        {formatAmount(transaction.fromAmount || 0, transaction.currency)}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" noWrap>
                        {getAccountName(transaction.accountId)}
                      </Typography>
                      <Typography 
                        variant="subtitle2" 
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatAmount(transaction.amount, transaction.currency)}
                      </Typography>
                    </>
                  )}

                  {transaction.category && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {transaction.category}
                    </Typography>
                  )}

                  {transaction.description && (
                    <Typography variant="body2" color="text.secondary" fontSize="0.75rem" noWrap>
                      {transaction.description}
                    </Typography>
                  )}
                </Box>

                <IconButton
                  size="small"
                  onClick={() => handleDelete(transaction.id)}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </ListItem>
      ))}
    </List>
  );
};
