import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import type { Env } from '../../worker-configuration';

type Variables = {
  db: any;
  currencyService: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get exchange rate (public endpoint - no auth required)
app.get(
  '/rate',
  zValidator(
    'query',
    z.object({
      from: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      to: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
    })
  ),
  async (c) => {
    const { from, to } = c.req.valid('query');
    const currencyService = c.get('currencyService');

    try {
      const rate = await currencyService.getExchangeRate(from, to);
      return c.json({ 
        id: `${from}-${to}`,
        fromCurrency: from,
        toCurrency: to,
        rate,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      return c.json({ error: 'Failed to fetch exchange rate' }, 500);
    }
  }
);

// Get multiple exchange rates
app.get(
  '/rates',
  authMiddleware,
  zValidator(
    'query',
    z.object({
      base: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      targets: z.string().transform((val) => val.split(',')),
    })
  ),
  async (c) => {
    const { base, targets } = c.req.valid('query');
    const currencyService = c.get('currencyService');

    // Validate targets
    const validCurrencies = ['KZT', 'USD', 'EUR', 'BTC'];
    const validTargets = targets.filter((t) => validCurrencies.includes(t));

    try {
      const rates = await currencyService.getMultipleRates(base, validTargets as any);
      return c.json({ base, rates });
    } catch (error) {
      return c.json({ error: 'Failed to fetch exchange rates' }, 500);
    }
  }
);

// Convert amount
app.post(
  '/convert',
  authMiddleware,
  zValidator(
    'json',
    z.object({
      amount: z.number(),
      from: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      to: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
    })
  ),
  async (c) => {
    const { amount, from, to } = c.req.valid('json');
    const currencyService = c.get('currencyService');

    try {
      const convertedAmount = await currencyService.convert(amount, from, to);
      const rate = await currencyService.getExchangeRate(from, to);

      return c.json({
        originalAmount: amount,
        convertedAmount,
        from,
        to,
        rate,
      });
    } catch (error) {
      return c.json({ error: 'Failed to convert currency' }, 500);
    }
  }
);

// Get historical rates for chart (public endpoint)
app.get(
  '/history',
  zValidator(
    'query',
    z.object({
      from: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      to: z.enum(['KZT', 'USD', 'EUR', 'BTC']),
      period: z.enum(['24h', '7d', '30d']).default('7d'),
    })
  ),
  async (c) => {
    const { from, to, period } = c.req.valid('query');
    const currencyService = c.get('currencyService');

    try {
      // Вычисляем начальную метку времени
      const now = Date.now();
      let startTimestamp: number;
      
      switch (period) {
        case '24h':
          startTimestamp = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);
          break;
        case '7d':
          startTimestamp = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000);
          break;
        case '30d':
          startTimestamp = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
          break;
      }

      const history = await currencyService.getHistoricalRates(from, to, startTimestamp);
      
      return c.json({
        from,
        to,
        period,
        data: history.map((h: any) => ({
          rate: h.rate,
          timestamp: h.timestamp.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error fetching historical rates:', error);
      return c.json({ error: 'Failed to fetch historical rates' }, 500);
    }
  }
);

export default app;
