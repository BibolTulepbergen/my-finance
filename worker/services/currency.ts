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

  // Получить базовый курс относительно USD из кеша
  private async getBaseRate(currency: SupportedCurrency): Promise<number | null> {
    if (currency === 'USD') return 1;
    
    const pairId = `USD-${currency}`;
    
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

    return cached ? cached.rate : null;
  }

  // Сохранить базовый курс в кеш
  private async saveBaseRate(currency: SupportedCurrency, rate: number): Promise<void> {
    if (currency === 'USD') return;
    
    const pairId = `USD-${currency}`;
    
    await this.db
      .insert(exchangeRates)
      .values({
        id: pairId,
        fromCurrency: 'USD',
        toCurrency: currency,
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
  }

  // Получить курс обмена с кешированием (оптимизированная версия)
  async getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    // Одинаковые валюты
    if (from === to) return 1;

    // Проверяем кеш для базовых курсов
    let fromRate = await this.getBaseRate(from);
    let toRate = await this.getBaseRate(to);

    // Если нет в кеше, загружаем из API
    if (fromRate === null) {
      fromRate = from === 'USD' ? 1 : await this.fetchExchangeRate('USD', from);
      await this.saveBaseRate(from, fromRate);
    }

    if (toRate === null) {
      toRate = to === 'USD' ? 1 : await this.fetchExchangeRate('USD', to);
      await this.saveBaseRate(to, toRate);
    }

    // Вычисляем кросс-курс через USD
    // from -> USD -> to
    // Например: EUR -> USD -> KZT = (USD/EUR) * (KZT/USD) = KZT/EUR
    const rate = toRate / fromRate;
    
    return rate;
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
      }
    }
    
    console.log('✓ All base rates refreshed. Cross rates will be calculated on demand.');
  }

  // Очистить старые неиспользуемые записи (оставляем только базовые курсы USD-*)
  async cleanupOldRates(): Promise<void> {
    try {
      // Удаляем все записи, которые НЕ являются базовыми курсами (fromCurrency != 'USD')
      // или слишком старые (> 24 часов)
      await this.db
        .delete(exchangeRates)
        .where(
          sql`${exchangeRates.fromCurrency} != 'USD' OR ${exchangeRates.lastUpdated} < unixepoch() - 86400`
        )
        .run();
      
      console.log('✓ Cleaned up old exchange rate records');
    } catch (error) {
      console.error('✗ Failed to cleanup old rates:', error);
    }
  }
}
