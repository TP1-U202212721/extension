import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './style.css';

const contenedor = document.getElementById('root');
if (contenedor !== null) createRoot(contenedor).render(<App />);
