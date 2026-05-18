import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-text">
        <App />
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
