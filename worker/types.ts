import type { DB } from './db';
import type { CurrencyService } from './services/currency';

declare module 'hono' {
  interface ContextVariableMap {
    db: DB;
    currencyService: CurrencyService;
  }
}
