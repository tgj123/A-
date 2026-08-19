import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { RotationPage } from './flow/RotationPage'
import { getFlowRoute } from './flow/rotationModel'
import './styles.css'

const flowRoute = getFlowRoute(window.location.pathname)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {flowRoute ? <RotationPage mode={flowRoute} /> : <App />}
  </React.StrictMode>,
)
