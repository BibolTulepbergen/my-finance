-- Миграция: Изменение схемы exchange_rates для сохранения истории курсов
-- Удаляем старую таблицу и создаем новую

DROP TABLE IF EXISTS `exchange_rates`;

CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`from_currency` text NOT NULL,
	`to_currency` text NOT NULL,
	`rate` real NOT NULL,
	`source` text DEFAULT 'yahoo-finance' NOT NULL,
	`timestamp` integer NOT NULL
);

-- Индекс для быстрого поиска последнего курса
CREATE INDEX `idx_exchange_rates_lookup` ON `exchange_rates` (`from_currency`, `to_currency`, `timestamp`);

-- Индекс для очистки старых записей
CREATE INDEX `idx_exchange_rates_timestamp` ON `exchange_rates` (`timestamp`);


