import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import './index.css'
import App from './App.tsx'

// Настройка Status Bar для мобильного приложения
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {
    // Игнорируем ошибку если плагин недоступен
  });
  // Стиль StatusBar теперь управляется через ThemeContext
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
