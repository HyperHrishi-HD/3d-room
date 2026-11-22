import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { RoomProvider } from './state/roomStore'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RoomProvider>
      <App />
    </RoomProvider>
  </StrictMode>,
)
