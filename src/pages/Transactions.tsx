import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { accountApi } from '../lib/api';
import { TransactionModal } from '../components/transactions/TransactionModal';
import { TransactionList } from '../components/transactions/TransactionList';
import { TransactionStatsCards } from '../components/transactions/TransactionStatsCards';
import type { Account, TransactionFilters } from '../lib/types';

export const Transactions: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { accounts: data } = await accountApi.getAll();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionCreated = () => {
    setRefreshKey(prev => prev + 1);
    loadAccounts();
  };

  const handleTransactionDeleted = () => {
    setRefreshKey(prev => prev + 1);
    loadAccounts();
  };

  const handleClearFilters = () => {
    setFilterType('');
    setFilterAccountId('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const filters: TransactionFilters = {
    type: filterType || undefined,
    accountId: filterAccountId || undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
  };

  const hasActiveFilters = filterType || filterAccountId || filterStartDate || filterEndDate;

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Typography>Загрузка...</Typography>
        </Box>
      </Container>
    );
  }

  if (accounts.length === 0) {
    return (
      <Container sx={{ py: 3 }}>
        <Alert severity="warning">
          У вас пока нет счетов. Создайте счет, чтобы начать работу с транзакциями.
        </Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 3, pb: 10 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Транзакции
        </Typography>
        <IconButton 
          onClick={() => setShowFilters(true)}
          color={hasActiveFilters ? 'primary' : 'default'}
        >
          <FilterIcon />
        </IconButton>
      </Box>

      {hasActiveFilters && (
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          {filterType && (
            <Chip
              label={`Тип: ${filterType === 'income' ? 'Доход' : filterType === 'expense' ? 'Расход' : 'Перевод'}`}
              onDelete={() => setFilterType('')}
              size="small"
            />
          )}
          {filterAccountId && (
            <Chip
              label={`Счет: ${accounts.find(a => a.id === filterAccountId)?.name}`}
              onDelete={() => setFilterAccountId('')}
              size="small"
            />
          )}
          {filterStartDate && (
            <Chip
              label={`От: ${new Date(filterStartDate).toLocaleDateString('ru-RU')}`}
              onDelete={() => setFilterStartDate('')}
              size="small"
            />
          )}
          {filterEndDate && (
            <Chip
              label={`До: ${new Date(filterEndDate).toLocaleDateString('ru-RU')}`}
              onDelete={() => setFilterEndDate('')}
              size="small"
            />
          )}
          <Chip
            label="Сбросить всё"
            onClick={handleClearFilters}
            size="small"
            color="error"
            variant="outlined"
          />
        </Box>
      )}

      <Box mb={3}>
        <TransactionStatsCards
          startDate={filterStartDate}
          endDate={filterEndDate}
        />
      </Box>

      <TransactionList
        key={refreshKey}
        accounts={accounts}
        filters={filters}
        onTransactionDeleted={handleTransactionDeleted}
      />

      <Fab
        color="primary"
        aria-label="add"
        onClick={() => setShowModal(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>

      <TransactionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleTransactionCreated}
        accounts={accounts}
      />

      <Dialog
        open={showFilters}
        onClose={() => setShowFilters(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Фильтры
            <IconButton onClick={() => setShowFilters(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Тип транзакции"
            fullWidth
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            margin="normal"
          >
            <MenuItem value="">Все</MenuItem>
            <MenuItem value="income">Доход</MenuItem>
            <MenuItem value="expense">Расход</MenuItem>
            <MenuItem value="transfer">Перевод</MenuItem>
          </TextField>

          <TextField
            select
            label="Счет"
            fullWidth
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            margin="normal"
          >
            <MenuItem value="">Все счета</MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Дата от"
            type="date"
            fullWidth
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Дата до"
            type="date"
            fullWidth
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters} color="error">
            Сбросить
          </Button>
          <Button onClick={() => setShowFilters(false)} variant="contained">
            Применить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
