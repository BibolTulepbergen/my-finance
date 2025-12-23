import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'
import App from './App.tsx'

// Настройка Status Bar для мобильного приложения
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {
    // Игнорируем ошибку если плагин недоступен
  });
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {
    // Игнорируем ошибку если плагин недоступен
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
