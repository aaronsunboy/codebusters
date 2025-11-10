// xenocrypt-main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import XenocryptPractice from './XenocryptPractice'; // Import the new component

// Find the root HTML element
const rootElement = document.getElementById('root'); 

// Create the React root and render the component
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <XenocryptPractice />
  </React.StrictMode>
);