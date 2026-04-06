import './index.css'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

if (navigator.userAgent.toLowerCase().includes('windows')) {
  document.body.classList.add('border-t', 'border-border')
}

createRoot(document.body).render(createElement(App))
