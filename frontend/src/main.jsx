import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import React from 'react'
import { CssBaseline, ThemeProvider } from "@mui/material"
import './index.css'
import App from './App'
import { I18nProvider } from './i18n'
import { appTheme } from "./theme"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
