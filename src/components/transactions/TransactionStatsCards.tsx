import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  SwapHoriz,
  AccountBalance,
} from '@mui/icons-material';
import { transactionApi } from '../../lib/api';
import type { TransactionStats } from '../../lib/types';

interface TransactionStatsProps {
  startDate?: string;
  endDate?: string;
}

export const TransactionStatsCards: React.FC<TransactionStatsProps> = ({ startDate, endDate }) => {
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [startDate, endDate]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionApi.getStats({ startDate, endDate });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!stats) {
    return null;
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={3}>
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Доходы
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {formatAmount(stats.income.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.income.count} тр.
                </Typography>
              </Box>
              <TrendingUp sx={{ fontSize: 32, color: 'success.light', opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={6} sm={3}>
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Расходы
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  {formatAmount(stats.expense.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.expense.count} тр.
                </Typography>
              </Box>
              <TrendingDown sx={{ fontSize: 32, color: 'error.light', opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={6} sm={3}>
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Переводы
                </Typography>
                <Typography variant="h6" color="info.main" fontWeight="bold">
                  {formatAmount(stats.transfer.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.transfer.count} тр.
                </Typography>
              </Box>
              <SwapHoriz sx={{ fontSize: 32, color: 'info.light', opacity: 0.7 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={6} sm={3}>
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Баланс
                </Typography>
                <Typography 
                  variant="h6" 
                  color={stats.balance >= 0 ? 'success.main' : 'error.main'}
                  fontWeight="bold"
                >
                  {stats.balance >= 0 ? '+' : ''}
                  {formatAmount(stats.balance)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  доход - расход
                </Typography>
              </Box>
              <AccountBalance 
                sx={{ 
                  fontSize: 32, 
                  color: stats.balance >= 0 ? 'success.light' : 'error.light',
                  opacity: 0.7 
                }} 
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
