import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RacetrackPage from './pages/RacetrackPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RacetrackPage />
  </StrictMode>,
)
