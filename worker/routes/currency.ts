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

export default app;
