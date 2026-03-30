import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.less'
import App from './App'
import { APP_DOM_ID } from './consts/const'

const body = document.querySelector('body')
const app = document.createElement('div')
app.id = APP_DOM_ID
if (body != null) {
  body.prepend(app)
}

ReactDOM.createRoot(document.getElementById(APP_DOM_ID) as HTMLElement).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)
