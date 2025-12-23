import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  AccountBalanceWallet,
  Savings,
  CurrencyBitcoin,
  AccountBalance,
} from '@mui/icons-material';
import { accountApi } from '../../lib/api';

const ACCOUNT_TYPE_ICONS: Record<string, React.ReactNode> = {
  wallet: <AccountBalanceWallet />,
  savings: <Savings />,
  crypto: <CurrencyBitcoin />,
  bank: <AccountBalance />,
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  wallet: 'Кошелек',
  savings: 'Копилка',
  crypto: 'Криптокошелек',
  bank: 'Банковский счет',
};

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  balanceInBaseCurrency?: number;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

interface AccountListProps {
  onEdit: (account: Account) => void;
  onAdd: () => void;
}

export function AccountList({ onEdit, onAdd }: AccountListProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<{
    baseCurrency: string;
    totalBalance: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showArchived, setShowArchived] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const [accountsData, summaryData] = await Promise.all([
        accountApi.getAll(),
        accountApi.getSummary(),
      ]);
      
      setAccounts(accountsData.accounts);
      setSummary({
        baseCurrency: summaryData.baseCurrency,
        totalBalance: summaryData.totalBalance,
      });
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить счета');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [refreshTrigger]);

  const handleArchive = async (id: string, balance: number) => {
    if (balance !== 0) {
      alert('Нельзя архивировать счет с ненулевым балансом. Переведите или потратьте средства.');
      return;
    }

    if (!confirm('Переместить счет в архив?')) {
      return;
    }

    try {
      await accountApi.archive(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Не удалось архивировать счет');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await accountApi.restore(id);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Не удалось восстановить счет');
    }
  };

  const filteredAccounts = showArchived 
    ? accounts.filter(a => !a.isActive)
    : accounts.filter(a => a.isActive);

  const formatBalance = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: currency === 'BTC' ? 8 : 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary Card */}
      {summary && (
        <Card
          sx={{
            mb: 3,
            color: 'common.white',
            background: 'linear-gradient(135deg, #1e88e5, #42a5f5)',
            borderRadius: 3,
            boxShadow: 6,
          }}
        >
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Typography variant="h6">Общий баланс</Typography>
              <Chip
                label={`База: ${summary.baseCurrency}`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'common.white' }}
              />
            </Box>
            <Typography variant="h3" fontWeight="bold" sx={{ lineHeight: 1.1 }}>
              {formatBalance(summary.totalBalance, summary.baseCurrency)} {summary.baseCurrency}
            </Typography>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Add Account Button */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
        >
          Добавить счет
        </Button>
        <Button
          variant={showArchived ? 'contained' : 'outlined'}
          startIcon={showArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Активные' : 'Архив'}
        </Button>
      </Stack>

      {/* Accounts List */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 2,
        }}
      >
        {filteredAccounts.map((account) => (
          <Card
            key={account.id}
            sx={{
              height: '100%',
              border: account.color ? `2px solid ${account.color}` : undefined,
              opacity: account.isActive ? 1 : 0.6,
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box display="flex" alignItems="center" gap={1}>
                    {ACCOUNT_TYPE_ICONS[account.type]}
                    <Typography variant="h6">{account.name}</Typography>
                  </Box>
                  <Box>
                    {account.isActive && (
                      <IconButton size="small" onClick={() => onEdit(account)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {account.isActive ? (
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => handleArchive(account.id, account.balance)}
                        title="В архив"
                      >
                        <ArchiveIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleRestore(account.id)}
                        title="Восстановить"
                      >
                        <UnarchiveIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    label={ACCOUNT_TYPE_LABELS[account.type]}
                    size="small"
                  />
                  {!account.isActive && (
                    <Chip
                      label="Архив"
                      size="small"
                      color="default"
                    />
                  )}
                </Box>

                <Box>
                  <Typography variant="h5">
                    {formatBalance(account.balance, account.currency)} {account.currency}
                  </Typography>
                  {account.balanceInBaseCurrency !== undefined &&
                    summary &&
                    account.currency !== summary.baseCurrency && (
                      <Typography variant="body2" color="text.secondary">
                        ≈ {formatBalance(account.balanceInBaseCurrency, summary.baseCurrency)}{' '}
                        {summary.baseCurrency}
                      </Typography>
                    )}
                </Box>

                {account.description && (
                  <Typography variant="body2" color="text.secondary">
                    {account.description}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {filteredAccounts.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {showArchived ? 'Нет архивных счетов' : 'У вас пока нет счетов'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {showArchived 
              ? 'Архивные счета будут отображаться здесь'
              : 'Добавьте первый счет для отслеживания ваших финансов'
            }
          </Typography>
        </Box>
      )}
    </Box>
  );
}
