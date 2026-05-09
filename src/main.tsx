import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BasePage from './BasePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BasePage />
  </StrictMode>,
)
