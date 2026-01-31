/**
 * FormBridge Admin Dashboard Entry Point
 */

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

// Create a simple placeholder app for now
function App() {
  return createElement(
    'div',
    { style: { padding: '20px' } },
    createElement('h1', null, 'FormBridge Admin Dashboard'),
    createElement('p', null, 'Dashboard components are available but no main app is configured yet.')
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(createElement(App));
} else {
  console.error('Root container not found');
}