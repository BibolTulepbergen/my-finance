# My Finance

Финансовое приложение на React с использованием Material UI и Capacitor для мобильных платформ.

## Технологии

- **React 19** - UI библиотека
- **TypeScript** - типизация
- **Vite** - сборщик и dev сервер
- **Material UI v7** - UI компоненты (Material Design)
- **Emotion** - CSS-in-JS для стилизации
- **Capacitor 8** - для создания нативных мобильных приложений
- **Cloudflare Workers** - для деплоя веб-версии

## Установка

```bash
npm install
```

## Настройка API

Для работы приложения необходимо настроить URL вашего Cloudflare Worker API.

### Для Android приложения

1. Откройте `capacitor.config.ts`
2. Раскомментируйте и установите URL вашего API:

```typescript
server: {
 
  cleartext: false,
}
```

### Для веб-версии (опционально)

Создайте файл `.env` в корне проекта (если нужно переопределить API URL):

```bash
VITE_API_URL=https://my-finance-dev.moldahasank.workers.dev/api
```

По умолчанию используется относительный путь `/api`, что подходит для локальной разработки с Cloudflare Workers.

## Запуск проекта

### Веб-версия

```bash
npm run dev          # Запуск dev сервера
npm run build        # Сборка для продакшена
npm run preview      # Превью продакшен сборки
npm run deploy       # Деплой на Cloudflare Workers
```

### Android

```bash
npm run android:build  # Сборка и синхронизация с Android
npm run android:open   # Открыть проект в Android Studio
npm run android:run    # Сборка и запуск на устройстве/эмуляторе
```

## Material UI v7

В проекте используется Material UI v7.3.6 для создания современного интерфейса.

### Основные компоненты

```typescript
import { Button, TextField, Box, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

function Example() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Заголовок
      </Typography>
      <TextField 
        label="Введите текст" 
        variant="outlined" 
        fullWidth 
        sx={{ mb: 2 }}
      />
      <Button 
        variant="contained" 
        startIcon={<AddIcon />}
      >
        Добавить
      </Button>
    </Box>
  );
}
```

### Полезные ссылки

- [Material UI документация](https://mui.com/material-ui/getting-started/)
- [Все компоненты](https://mui.com/material-ui/all-components/)
- [Иконки](https://mui.com/material-ui/material-icons/)
- [Система стилей (sx prop)](https://mui.com/system/getting-started/the-sx-prop/)

## Разработка

### Структура проекта

```
my-finance/
├── src/              # Исходный код приложения
├── public/           # Статические файлы
├── android/          # Android проект (Capacitor)
├── worker/           # Cloudflare Workers
└── dist/             # Сборка (генерируется)
```

### Линтинг

```bash
npm run lint         # Проверка кода с ESLint
```

### Типизация

```bash
npm run cf-typegen   # Генерация типов для Cloudflare Workers
```
