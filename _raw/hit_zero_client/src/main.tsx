// src/main.tsx — entry point. Boots native bridges, mounts React.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initNative } from './lib/native';
import './styles.css';

initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
