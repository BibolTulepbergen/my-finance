import type { DB } from '../db';
import { exchangeRates } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Оптимизированный сервис для работы с валютными курсами
 * 
 * Вместо хранения всех 12 пар валют (4×3), мы храним только 3 базовых курса относительно USD:
 * - USD-EUR
 * - USD-KZT
 * - USD-BTC
 * 
 * Все кросс-курсы (например EUR-KZT, BTC-EUR) вычисляются автоматически через USD:
 * EUR-KZT = (USD-KZT) / (USD-EUR)
 * 
 * Это уменьшает количество API запросов и записей в БД в 4 раза!
 */

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

  // Получить последний базовый курс относительно USD из БД
  private async getBaseRate(currency: SupportedCurrency): Promise<number | null> {
    if (currency === 'USD') return 1;
    
    // Получаем последнюю запись для данной пары (сортируем по timestamp DESC)
    // Кеш действителен 1 час
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    
    const cached = await this.db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.fromCurrency, 'USD'),
          eq(exchangeRates.toCurrency, currency),
          sql`${exchangeRates.timestamp} > ${oneHourAgo}`
        )
      )
      .orderBy(sql`${exchangeRates.timestamp} DESC`)
      .limit(1)
      .get();

    return cached ? cached.rate : null;
  }

  // Сохранить базовый курс как новую запись (для истории)
  private async saveBaseRate(currency: SupportedCurrency, rate: number): Promise<void> {
    if (currency === 'USD') return;
    
    const timestamp = new Date();
    const timestampUnix = Math.floor(timestamp.getTime() / 1000);
    const recordId = `USD-${currency}-${timestampUnix}`;
    
    // Всегда создаем новую запись для сохранения истории
    await this.db
      .insert(exchangeRates)
      .values({
        id: recordId,
        fromCurrency: 'USD',
        toCurrency: currency,
        rate,
        source: 'exchangerate-api',
        timestamp,
      })
      .run();
  }

  // Получить курс обмена с кешированием (оптимизированная версия)
  async getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    try {
      // Одинаковые валюты
      if (from === to) return 1;

      // Проверяем кеш для базовых курсов
      let fromRate = await this.getBaseRate(from);
      let toRate = await this.getBaseRate(to);

      // Если нет в кеше, загружаем из API
      if (fromRate === null) {
        try {
          fromRate = from === 'USD' ? 1 : await this.fetchExchangeRate('USD', from);
          await this.saveBaseRate(from, fromRate);
        } catch (error) {
          console.error(`Failed to fetch rate for USD-${from}, using fallback:`, error);
          // Fallback: используем 1:1 курс если API недоступен
          fromRate = 1;
        }
      }

      if (toRate === null) {
        try {
          toRate = to === 'USD' ? 1 : await this.fetchExchangeRate('USD', to);
          await this.saveBaseRate(to, toRate);
        } catch (error) {
          console.error(`Failed to fetch rate for USD-${to}, using fallback:`, error);
          // Fallback: используем 1:1 курс если API недоступен
          toRate = 1;
        }
      }

      // Вычисляем кросс-курс через USD
      // from -> USD -> to
      // Например: EUR -> USD -> KZT = (USD/EUR) * (KZT/USD) = KZT/EUR
      const rate = toRate / fromRate;
      
      return rate;
    } catch (error) {
      console.error(`Unexpected error in getExchangeRate(${from}, ${to}):`, error);
      // Last resort fallback: 1:1 курс
      return 1;
    }
  }

  // Получить курс USD -> currency через бесплатные API
  private async fetchExchangeRate(from: 'USD', to: SupportedCurrency): Promise<number> {
    try {
      // USD -> BTC (крипто)
      if (to === 'BTC') {
        const btcToUsd = await this.fetchCryptoToFiat('BTC', 'USD');
        return 1 / btcToUsd; // USD -> BTC
      }

      // USD -> Фиат (EUR, KZT)
      return await this.fetchFiatRate('USD', to);
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

  // Получить курс крипты через несколько API (с fallback)
  private async fetchCryptoToFiat(crypto: 'BTC', fiat: string): Promise<number> {
    // Пробуем несколько API по очереди
    const apis = [
      () => this.fetchCryptoFromBlockchain(crypto, fiat),
      () => this.fetchCryptoFromCoinGecko(crypto, fiat),
      () => this.fetchCryptoFromCoinDesk(crypto, fiat),
    ];

    for (const apiFn of apis) {
      try {
        const rate = await apiFn();
        if (rate && rate > 0) {
          return rate;
        }
      } catch (error) {
        console.error(`Crypto API failed, trying next:`, error);
        continue;
      }
    }

    throw new Error(`All crypto APIs failed for ${crypto}-${fiat}`);
  }

  // Blockchain.com API (надежный, без rate limits)
  private async fetchCryptoFromBlockchain(_crypto: 'BTC', fiat: string): Promise<number> {
    try {
      const response = await fetch('https://blockchain.info/ticker');
      if (!response.ok) throw new Error(`Blockchain API error: ${response.status}`);
      
      const data: any = await response.json();
      const fiatUpper = fiat.toUpperCase();
      
      if (data[fiatUpper]?.last) {
        return data[fiatUpper].last;
      }
      
      throw new Error(`Currency ${fiatUpper} not found in Blockchain API`);
    } catch (error) {
      console.error(`Blockchain API error:`, error);
      throw error;
    }
  }

  // CoinGecko API (бесплатный, но с rate limits)
  private async fetchCryptoFromCoinGecko(_crypto: 'BTC', fiat: string): Promise<number> {
    try {
      const cryptoId = 'bitcoin';
      const fiatLower = fiat.toLowerCase();
      
      const response = await fetch(
        `${COINGECKO_API}?ids=${cryptoId}&vs_currencies=${fiatLower}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: any = await response.json();
      const rate = data?.[cryptoId]?.[fiatLower];

      if (!rate) {
        throw new Error(`Rate not available from CoinGecko`);
      }

      return rate;
    } catch (error) {
      console.error(`CoinGecko API error:`, error);
      throw error;
    }
  }

  // CoinDesk API (надежный, публичный)
  private async fetchCryptoFromCoinDesk(_crypto: 'BTC', fiat: string): Promise<number> {
    try {
      // CoinDesk предоставляет только USD, EUR, GBP
      const supportedCurrencies = ['USD', 'EUR', 'GBP'];
      const fiatUpper = fiat.toUpperCase();
      
      if (!supportedCurrencies.includes(fiatUpper)) {
        // Если валюта не поддерживается, получаем курс BTC-USD и конвертируем
        const btcUsd = await this.fetchCryptoFromCoinDesk('BTC', 'USD');
        const usdToFiat = await this.fetchFiatRate('USD', fiat);
        return btcUsd * usdToFiat;
      }

      const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
      if (!response.ok) throw new Error(`CoinDesk API error: ${response.status}`);
      
      const data: any = await response.json();
      const rate = data?.bpi?.[fiatUpper]?.rate_float;
      
      if (!rate) {
        throw new Error(`Rate not available from CoinDesk`);
      }
      
      return rate;
    } catch (error) {
      console.error(`CoinDesk API error:`, error);
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

  // Обновить все базовые курсы (оптимизировано - только 3 пары вместо 12)
  async refreshAllRates(): Promise<void> {
    const currencies: SupportedCurrency[] = ['EUR', 'KZT', 'BTC'];
    
    // Обновляем только базовые курсы относительно USD
    for (const currency of currencies) {
      try {
        const rate = await this.fetchExchangeRate('USD', currency);
        await this.saveBaseRate(currency, rate);
        console.log(`✓ Refreshed base rate: USD-${currency} = ${rate}`);
      } catch (error) {
        console.error(`✗ Failed to refresh USD-${currency}:`, error);
        
        // Для криптовалют при rate limit - продолжаем работу с кешем
        if (currency === 'BTC' && error instanceof Error && error.message.includes('Rate limit')) {
          console.log(`ℹ Using cached rate for USD-${currency}`);
        }
      }
      
      // Добавляем небольшую задержку между запросами, чтобы избежать rate limiting
      if (currency === 'BTC') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✓ All base rates refreshed. Cross rates will be calculated on demand.');
  }

  // Очистить очень старые записи (оставляем историю за последние 30 дней)
  async cleanupOldRates(): Promise<void> {
    try {
      // Удаляем записи старше 30 дней
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
      
      await this.db
        .delete(exchangeRates)
        .where(
          sql`${exchangeRates.timestamp} < ${thirtyDaysAgo}`
        )
        .run();
      
      console.log('✓ Cleaned up old exchange rate records (older than 30 days)');
    } catch (error) {
      console.error('✗ Failed to cleanup old rates:', error);
    }
  }

  // Получить историю курса для построения графика
  async getHistoricalRates(
    from: SupportedCurrency,
    to: SupportedCurrency,
    startTimestamp: number
  ): Promise<Array<{ rate: number; timestamp: Date }>> {
    try {
      // Если валюты одинаковые
      if (from === to) {
        return [{ rate: 1, timestamp: new Date() }];
      }

      // Получаем базовые курсы для обеих валют
      const fromRates = from === 'USD' 
        ? [{ rate: 1, timestamp: new Date() }]
        : await this.db
            .select({
              rate: exchangeRates.rate,
              timestamp: exchangeRates.timestamp,
            })
            .from(exchangeRates)
            .where(
              and(
                eq(exchangeRates.fromCurrency, 'USD'),
                eq(exchangeRates.toCurrency, from),
                sql`${exchangeRates.timestamp} >= ${startTimestamp}`
              )
            )
            .orderBy(sql`${exchangeRates.timestamp} ASC`)
            .all();

      const toRates = to === 'USD'
        ? [{ rate: 1, timestamp: new Date() }]
        : await this.db
            .select({
              rate: exchangeRates.rate,
              timestamp: exchangeRates.timestamp,
            })
            .from(exchangeRates)
            .where(
              and(
                eq(exchangeRates.fromCurrency, 'USD'),
                eq(exchangeRates.toCurrency, to),
                sql`${exchangeRates.timestamp} >= ${startTimestamp}`
              )
            )
            .orderBy(sql`${exchangeRates.timestamp} ASC`)
            .all();

      // Если одна из валют USD, возвращаем прямые курсы
      if (from === 'USD') {
        return toRates;
      }
      if (to === 'USD') {
        return fromRates.map(r => ({
          rate: 1 / r.rate,
          timestamp: r.timestamp,
        }));
      }

      // Для кросс-курсов нужно синхронизировать по времени
      // Упрощенный подход: берем пересечение timestamps
      const result: Array<{ rate: number; timestamp: Date }> = [];
      const toRatesMap = new Map(toRates.map(r => [r.timestamp.getTime(), r.rate]));

      for (const fromRate of fromRates) {
        const toRate = toRatesMap.get(fromRate.timestamp.getTime());
        if (toRate) {
          result.push({
            rate: toRate / fromRate.rate,
            timestamp: fromRate.timestamp,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error fetching historical rates:', error);
      return [];
    }
  }
}
