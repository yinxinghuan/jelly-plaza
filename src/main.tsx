import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { JellyPlaza } from './JellyPlaza'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JellyPlaza />
  </StrictMode>,
)
