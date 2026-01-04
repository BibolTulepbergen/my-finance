import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip as MuiTooltip,
  FormControl,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Типы данных
interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  lastUpdated: string;
}

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

// Доступные валюты
const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿' },
];

// Все возможные пары для отображения внизу
const ALL_PAIRS = [
  { from: 'BTC', to: 'USD' },
  { from: 'BTC', to: 'EUR' },
  { from: 'BTC', to: 'KZT' },
  { from: 'USD', to: 'BTC' },
  { from: 'USD', to: 'EUR' },
  { from: 'USD', to: 'KZT' },
  { from: 'EUR', to: 'BTC' },
  { from: 'EUR', to: 'USD' },
  { from: 'EUR', to: 'KZT' },
  { from: 'KZT', to: 'BTC' },
  { from: 'KZT', to: 'USD' },
  { from: 'KZT', to: 'EUR' },
];

export function CurrencyRates() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [rates, setRates] = useState<Record<string, ExchangeRate>>({});
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<string>('USD');
  const [targetCurrency, setTargetCurrency] = useState<string>('KZT');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Загрузка текущих курсов
  useEffect(() => {
    loadAllRates();
    
    // Обновление каждый час
    const interval = setInterval(() => {
      loadAllRates();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Перезагружаем исторические данные при изменении выбранных валют или периода
  useEffect(() => {
    if (baseCurrency && targetCurrency) {
      loadHistoricalData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency, targetCurrency, timeRange]);

  const loadAllRates = async () => {
    try {
      setError(null);
      const ratesData: Record<string, ExchangeRate> = {};
      
      // Загружаем курсы для всех пар
      await Promise.all(
        ALL_PAIRS.map(async (pair) => {
          try {
            const response = await fetch(
              `/api/currency/rate?from=${pair.from}&to=${pair.to}`
            );
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                ratesData[`${pair.from}-${pair.to}`] = data;
              } else {
                console.error(`Failed to load rate for ${pair.from}-${pair.to}: Expected JSON, got ${contentType}`);
              }
            } else {
              console.error(`Failed to load rate for ${pair.from}-${pair.to}: HTTP ${response.status}`);
            }
          } catch (err) {
            console.error(`Failed to load rate for ${pair.from}-${pair.to}:`, err);
          }
        })
      );
      
      setRates(ratesData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Не удалось загрузить курсы валют');
      console.error('Failed to load rates:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllRates();
    await loadHistoricalData();
  };

  const loadHistoricalData = async () => {
    try {
      // Загружаем реальные исторические данные из API
      const response = await fetch(
        `/api/currency/history?from=${baseCurrency}&to=${targetCurrency}&period=${timeRange}`
      );
      
      if (!response.ok) {
        console.error(`Failed to load historical data from API: HTTP ${response.status}`);
        setHistoricalData([]);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Failed to load historical data: Expected JSON, got ${contentType}`);
        setHistoricalData([]);
        return;
      }

      const historyData = await response.json();
      
      // Если нет данных, показываем пустой график
      if (!historyData.data || historyData.data.length === 0) {
        setHistoricalData([]);
        return;
      }

      // Форматируем данные для графика
      const formattedData = historyData.data.map((item: any) => {
        const date = new Date(item.timestamp);
        return {
          time: date.toLocaleString('ru-RU', {
            month: 'short',
            day: 'numeric',
            hour: timeRange === '24h' ? 'numeric' : undefined,
          }),
          rate: item.rate,
          timestamp: date.getTime(),
        };
      });

      setHistoricalData(formattedData);
      
      // Обновляем текущий курс, если есть последняя точка
      if (formattedData.length > 0) {
        const pairKey = `${baseCurrency}-${targetCurrency}`;
        const latestRate = formattedData[formattedData.length - 1].rate;
        
        setRates(prev => ({
          ...prev,
          [pairKey]: {
            id: pairKey,
            fromCurrency: baseCurrency,
            toCurrency: targetCurrency,
            rate: latestRate,
            lastUpdated: new Date().toISOString(),
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load historical data:', err);
      setHistoricalData([]);
    }
  };

  const handleBaseCurrencyChange = (event: SelectChangeEvent<string>) => {
    const newBase = event.target.value;
    // Если базовая валюта совпадает с целевой, меняем целевую
    if (newBase === targetCurrency) {
      const otherCurrency = CURRENCIES.find(c => c.code !== newBase);
      if (otherCurrency) {
        setTargetCurrency(otherCurrency.code);
      }
    }
    setBaseCurrency(newBase);
  };

  const handleTargetCurrencyChange = (event: SelectChangeEvent<string>) => {
    const newTarget = event.target.value;
    // Если целевая валюта совпадает с базовой, меняем базовую
    if (newTarget === baseCurrency) {
      const otherCurrency = CURRENCIES.find(c => c.code !== newTarget);
      if (otherCurrency) {
        setBaseCurrency(otherCurrency.code);
      }
    }
    setTargetCurrency(newTarget);
  };

  const formatRate = (rate: number) => {
    if (rate > 1000) {
      return rate.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (rate > 1) {
      return rate.toFixed(4);
    } else if (rate > 0.0001) {
      return rate.toFixed(6);
    } else {
      return rate.toExponential(4);
    }
  };

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find(c => c.code === code)?.symbol || '';
  };

  if (loading && Object.keys(rates).length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: isMobile ? 2 : 0 }}>
      {/* Заголовок */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>
              Текущие курсы валют
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Последнее обновление: {lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          <MuiTooltip title="Refresh rates">
            <IconButton 
              onClick={handleRefresh} 
              disabled={refreshing}
              size={isMobile ? 'small' : 'medium'}
            >
              <RefreshIcon />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* График курсов */}
      <Paper sx={{ p: isMobile ? 2 : 3, mb: 3 }}>
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            График курсов валют
          </Typography>
          
          <Grid container spacing={2} alignItems="center" mb={3}>
            {/* Базовая валюта */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Базовая валюта
                </Typography>
                <Select
                  value={baseCurrency}
                  onChange={handleBaseCurrencyChange}
                  displayEmpty
                >
                  {CURRENCIES.map((currency) => (
                    <MenuItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Стрелка или текст "to" */}
            <Grid size={{ xs: 12, sm: 1 }} sx={{ textAlign: 'center', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="h6" color="text.secondary">→</Typography>
            </Grid>

            {/* Целевая валюта */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Целевая валюта
                </Typography>
                <Select
                  value={targetCurrency}
                  onChange={handleTargetCurrencyChange}
                  displayEmpty
                >
                  {CURRENCIES.map((currency) => (
                    <MenuItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Период */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Период
              </Typography>
              <ToggleButtonGroup
                value={timeRange}
                exclusive
                onChange={(_, newRange) => {
                  if (newRange !== null) {
                    setTimeRange(newRange);
                  }
                }}
                size="small"
                fullWidth
              >
                <ToggleButton value="24h">24ч</ToggleButton>
                <ToggleButton value="7d">7д</ToggleButton>
                <ToggleButton value="30d">30д</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Box>

        {/* График */}
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
          <LineChart
            data={historicalData}
            margin={{ 
              top: 10, 
              right: isMobile ? 10 : 30, 
              left: isMobile ? -10 : 10, 
              bottom: 0 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="time"
              style={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 60 : 30}
            />
            <YAxis
              style={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
              domain={['auto', 'auto']}
              tickFormatter={(value) => formatRate(value)}
              width={isMobile ? 60 : 80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '2px solid #1976d2',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              formatter={(value: any) => [
                formatRate(value),
                `${targetCurrency} (${getCurrencySymbol(targetCurrency)})`
              ]}
              labelFormatter={(label) => `Дата: ${label}`}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#333' }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#1976d2"
              strokeWidth={2}
              dot={{ fill: '#1976d2', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Все валютные пары */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Все валютные пары
        </Typography>
        <Grid container spacing={2}>
          {ALL_PAIRS.map((pair) => {
            const pairKey = `${pair.from}-${pair.to}`;
            const rate = rates[pairKey];
            
            if (!rate) {
              return (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={pairKey}>
                  <Card sx={{ height: '100%', opacity: 0.5 }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {pair.from} → {pair.to}
                      </Typography>
                      <Typography variant="body2">Загрузка...</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            }

            return (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={pairKey}>
                <Card 
                  sx={{ 
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => {
                    setBaseCurrency(pair.from);
                    setTargetCurrency(pair.to);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <CardContent>
                    <Stack spacing={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography 
                          variant="body2" 
                          color="primary" 
                          fontWeight="bold"
                          sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}
                        >
                          {pair.from} → {pair.to}
                        </Typography>
                        <Chip 
                          label="Кэш" 
                          size="small" 
                          sx={{ 
                            height: 18, 
                            fontSize: '0.65rem',
                            bgcolor: 'success.light',
                            color: 'success.dark',
                          }} 
                        />
                      </Box>
                      <Typography 
                        variant={isMobile ? 'h6' : 'h5'} 
                        fontWeight="bold"
                      >
                        {formatRate(rate.rate)}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}
                      >
                        1 {getCurrencySymbol(pair.from)} = {formatRate(rate.rate)} {getCurrencySymbol(pair.to)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </Box>
  );
}
