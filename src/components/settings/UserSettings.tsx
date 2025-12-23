import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../lib/api';

const CURRENCIES = [
  { value: 'KZT', label: 'KZT - Тенге' },
  { value: 'USD', label: 'USD - Доллар США' },
  { value: 'EUR', label: 'EUR - Евро' },
  { value: 'BTC', label: 'BTC - Bitcoin' },
];

export function UserSettings() {
  const { user, signOut, sendVerificationEmail } = useAuth();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { user: userData } = await userApi.getMe();
      setBaseCurrency(userData.baseCurrency || 'USD');
    } catch (err: any) {
      setError('Не удалось загрузить настройки');
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await userApi.updateSettings({ baseCurrency });
      setSuccess('Настройки сохранены');
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить настройки');
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      await sendVerificationEmail();
      setSuccess('Письмо с подтверждением отправлено');
    } catch (err: any) {
      setError('Не удалось отправить письмо');
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Настройки
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Profile Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Профиль
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Email
            </Typography>
            <Typography variant="body1">{user?.email}</Typography>
          </Box>

          {user?.displayName && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Имя
              </Typography>
              <Typography variant="body1">{user.displayName}</Typography>
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Статус подтверждения email
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body1">
                {user?.emailVerified ? '✅ Подтвержден' : '❌ Не подтвержден'}
              </Typography>
              {!user?.emailVerified && (
                <Button size="small" onClick={handleSendVerification}>
                  Отправить письмо
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Currency Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Валюта
          </Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>Базовая валюта</InputLabel>
            <Select
              value={baseCurrency}
              label="Базовая валюта"
              onChange={(e) => setBaseCurrency(e.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <MenuItem key={currency.value} value={currency.value}>
                  {currency.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Все балансы будут дублироваться в выбранной валюте
          </Typography>

          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Сохранить настройки'}
          </Button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card>
        <CardContent>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            onClick={signOut}
          >
            Выйти из аккаунта
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
