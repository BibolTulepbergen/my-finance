import type { DB } from '../db';
import { exchangeRates } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Поддерживаемые валюты: KZT, USD, EUR, BTC
export type SupportedCurrency = 'KZT' | 'USD' | 'EUR' | 'BTC';

// API endpoints
const EXCHANGERATE_API = 'https://api.exchangerate-api.com/v4/latest';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

export class CurrencyService {
  private db: DB;
  
  constructor(db: DB) {
    this.db = db;
  }

  // Получить курс обмена с кешированием
  async getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    // Одинаковые валюты
    if (from === to) return 1;

    const pairId = `${from}-${to}`;
    
    // Проверка кеша (действителен 1 час)
    const cached = await this.db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.id, pairId),
          sql`${exchangeRates.lastUpdated} > unixepoch() - 3600`
        )
      )
      .get();

    if (cached) {
      return cached.rate;
    }

    // Получить свежий курс
    const rate = await this.fetchExchangeRate(from, to);
    
    // Кешировать курс
    await this.db
      .insert(exchangeRates)
      .values({
        id: pairId,
        fromCurrency: from,
        toCurrency: to,
        rate,
        source: 'exchangerate-api',
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: exchangeRates.id,
        set: {
          rate,
          lastUpdated: new Date(),
        },
      })
      .run();

    return rate;
  }

  // Получить курс обмена через бесплатные API
  private async fetchExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    try {
      const isCrypto = (currency: string) => currency === 'BTC';
      const fromIsCrypto = isCrypto(from);
      const toIsCrypto = isCrypto(to);

      // BTC -> Фиат
      if (fromIsCrypto && !toIsCrypto) {
        return await this.fetchCryptoToFiat('BTC', to);
      }

      // Фиат -> BTC
      if (!fromIsCrypto && toIsCrypto) {
        const rate = await this.fetchCryptoToFiat('BTC', from);
        return 1 / rate;
      }

      // Оба фиатные валюты - используем ExchangeRate-API
      return await this.fetchFiatRate(from, to);
    } catch (error) {
      console.error(`Error fetching exchange rate for ${from}-${to}:`, error);
      throw error;
    }
  }

  // Получить курс фиатных валют через ExchangeRate-API (бесплатный, без ключа)
  private async fetchFiatRate(from: string, to: string): Promise<number> {
    try {
      const response = await fetch(`${EXCHANGERATE_API}/${from}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch rates: ${response.statusText}`);
      }

      const data: any = await response.json();
      const rate = data.rates?.[to];

      if (!rate) {
        throw new Error(`Rate not available for ${from}-${to}`);
      }

      return rate;
    } catch (error) {
      console.error(`Error fetching fiat rate:`, error);
      throw error;
    }
  }

  // Получить курс крипты через CoinGecko (бесплатный, без ключа)
  private async fetchCryptoToFiat(crypto: 'BTC', fiat: string): Promise<number> {
    try {
      const cryptoId = 'bitcoin';
      const fiatLower = fiat.toLowerCase();
      
      const response = await fetch(
        `${COINGECKO_API}?ids=${cryptoId}&vs_currencies=${fiatLower}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch crypto price: ${response.statusText}`);
      }

      const data: any = await response.json();
      const rate = data?.[cryptoId]?.[fiatLower];

      if (!rate) {
        throw new Error(`Crypto rate not available for ${crypto}-${fiat}`);
      }

      return rate;
    } catch (error) {
      console.error(`Error fetching crypto rate:`, error);
      throw error;
    }
  }

  // Конвертировать сумму из одной валюты в другую
  async convert(amount: number, from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    const rate = await this.getExchangeRate(from, to);
    return amount * rate;
  }

  // Получить несколько курсов обмена одновременно
  async getMultipleRates(base: SupportedCurrency, targets: SupportedCurrency[]): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};
    
    await Promise.all(
      targets.map(async (target) => {
        rates[target] = await this.getExchangeRate(base, target);
      })
    );

    return rates;
  }

  // Обновить все кешированные курсы (вызывается cron каждый час)
  async refreshAllRates(): Promise<void> {
    const currencies: SupportedCurrency[] = ['USD', 'EUR', 'KZT', 'BTC'];
    
    for (const from of currencies) {
      for (const to of currencies) {
        if (from !== to) {
          try {
            await this.getExchangeRate(from, to);
            console.log(`✓ Refreshed rate: ${from}-${to}`);
          } catch (error) {
            console.error(`✗ Failed to refresh ${from}-${to}:`, error);
          }
        }
      }
    }
  }
}
