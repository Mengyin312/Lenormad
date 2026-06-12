import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './components/App.tsx'
import { useAppStore } from './hooks/useAppState'

// 开发模式下暴露 store，方便调试
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__appStore = useAppStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
