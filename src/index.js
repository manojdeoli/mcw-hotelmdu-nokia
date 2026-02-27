import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App';
import KioskPage from './KioskPage';
import AttractMode from './components/AttractMode_new';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Simple routing based on pathname and hash
const pathname = window.location.pathname;
const hash = window.location.hash;
const isKiosk = pathname === '/kiosk';
const isAttractMode = pathname === '/attract-mode' || hash === '#/attract-mode';

root.render(
  <React.StrictMode>
    {isAttractMode ? <AttractMode /> : isKiosk ? <KioskPage /> : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
