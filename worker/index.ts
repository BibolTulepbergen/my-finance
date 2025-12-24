import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDB } from './db';
import { CurrencyService } from './services/currency';
import usersRouter from './routes/users';
import accountsRouter from './routes/accounts';
import currencyRouter from './routes/currency';
import transactionsRouter from './routes/transactions';
import type { Env } from '../worker-configuration';
import './types';

// Типизация для Hono app
type Variables = {
  db: ReturnType<typeof initDB>;
  currencyService: CurrencyService;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://localhost',
    'https://localhost:5173',
    'https://localhost:3000',
  ],
  credentials: true,
}));

// Initialize DB and services
app.use('*', async (c, next) => {
  const db = initDB(c.env.DataBase);
  const currencyService = new CurrencyService(db);
  
  c.set('db', db);
  c.set('currencyService', currencyService);
  
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/users', usersRouter);
app.route('/api/accounts', accountsRouter);
app.route('/api/currency', currencyRouter);
app.route('/api/transactions', transactionsRouter);

// Global error handler - always return JSON, never HTML
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Scheduled task to refresh exchange rates
export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) => {
    const db = initDB(env.DataBase);
    const currencyService = new CurrencyService(db);
    
    console.log('Running scheduled task: refreshing exchange rates');
    await currencyService.refreshAllRates();
    console.log('Exchange rates refreshed successfully');
    
    // Очищаем старые неиспользуемые записи
    console.log('Cleaning up old exchange rate records');
    await currencyService.cleanupOldRates();
    console.log('Cleanup completed');
  },
};
