import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { accountApi } from '../../lib/api';

const ACCOUNT_TYPES = [
  { value: 'wallet', label: 'Кошелек' },
  { value: 'savings', label: 'Копилка' },
  { value: 'crypto', label: 'Криптокошелек' },
  { value: 'bank', label: 'Банковский счет' },
];

const CURRENCIES = [
  { value: 'KZT', label: 'KZT - Тенге' },
  { value: 'USD', label: 'USD - Доллар США' },
  { value: 'EUR', label: 'EUR - Евро' },
  { value: 'BTC', label: 'BTC - Bitcoin' },
];

const COLORS = [
  '#1976d2',
  '#388e3c',
  '#d32f2f',
  '#f57c00',
  '#7b1fa2',
  '#0097a7',
  '#c2185b',
  '#455a64',
];

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account?: any;
}

export function AccountForm({ open, onClose, onSuccess, account }: AccountFormProps) {
  const isEdit = !!account;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'wallet',
    currency: account?.currency || 'USD',
    initialBalance: account?.balance || 0,
    description: account?.description || '',
    color: account?.color || COLORS[0],
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      if (isEdit) {
        // When editing, remove fields that shouldn't be updated
        const { initialBalance, currency, ...updateData } = formData;
        await accountApi.update(account.id, updateData);
      } else {
        await accountApi.create(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить счет');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Редактировать счет' : 'Добавить счет'}</DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Название"
          fullWidth
          required
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          margin="normal"
        />

        <FormControl fullWidth margin="normal" required>
          <InputLabel>Тип счета</InputLabel>
          <Select
            value={formData.type}
            label="Тип счета"
            onChange={(e) => handleChange('type', e.target.value)}
          >
            {ACCOUNT_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" required disabled={isEdit}>
          <InputLabel>Валюта</InputLabel>
          <Select
            value={formData.currency}
            label="Валюта"
            onChange={(e) => handleChange('currency', e.target.value)}
          >
            {CURRENCIES.map((currency) => (
              <MenuItem key={currency.value} value={currency.value}>
                {currency.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!isEdit && (
        <TextField
          label="Начальный баланс"
          type="number"
          fullWidth
            value={formData.initialBalance}
            onChange={(e) => handleChange('initialBalance', parseFloat(e.target.value) || 0)}
          margin="normal"
            inputProps={{ step: '0.01', min: 0 }}
            helperText="После создания баланс будет управляться через транзакции"
        />
        )}

        <TextField
          label="Описание"
          fullWidth
          multiline
          rows={2}
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          margin="normal"
        />

        <Box sx={{ mt: 2 }}>
          <InputLabel sx={{ mb: 1 }}>Цвет</InputLabel>
          <Box display="flex" gap={1}>
            {COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => handleChange('color', color)}
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: color,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: formData.color === color ? '3px solid #000' : '1px solid #ddd',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Отмена
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : isEdit ? 'Сохранить' : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
