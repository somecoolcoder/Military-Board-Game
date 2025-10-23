/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { initUI } from './src/ui';
import { loadDemo } from './src/scenarios';
import { saveLayout } from './src/ui';

// --- Comprehensive Error Handling ---
function displayError(error: any) {
    console.error("Caught error:", error);
    let body = document.querySelector('body');
    if (!body) {
        // If body isn't available yet, wait for it.
        document.addEventListener('DOMContentLoaded', () => {
            body = document.querySelector('body');
            if (body) renderError(body, error);
        });
    } else {
        renderError(body, error);
    }
}

function renderError(body: HTMLElement, error: any) {
    // Avoid displaying multiple error messages
    if (document.getElementById('app-error-message')) return;

    const errorContainer = document.createElement('div');
    errorContainer.id = 'app-error-message';
    Object.assign(errorContainer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
    });

    const errorBox = document.createElement('div');
    Object.assign(errorBox.style, {
        padding: '20px',
        background: '#2b0000',
        color: 'white',
        border: '2px solid darkred',
        borderRadius: '8px',
        maxWidth: '80%',
        maxHeight: '80%',
        overflow: 'auto',
        fontFamily: 'monospace'
    });

    let errorMessage = 'An unknown error occurred.';
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.stack || error.message;
    } else if (error.reason) { // For unhandled promise rejections
        const reason = error.reason;
        errorMessage = reason.stack || reason.message || (typeof reason === 'object' ? JSON.stringify(reason) : String(reason));
    } else if (error.message) {
        errorMessage = error.message;
    } else {
        try {
            errorMessage = JSON.stringify(error, null, 2);
        } catch (e) {
            errorMessage = 'Could not stringify error object.';
        }
    }

    errorBox.innerHTML = `
        <h2 style="color: #ff8a8a; margin-top: 0;">Application Error</h2>
        <p>The application encountered a problem and cannot continue. Please check the browser console for more details.</p>
        <pre style="white-space: pre-wrap; word-wrap: break-word; background: #1a0000; padding: 10px; border-radius: 4px;">${errorMessage}</pre>
    `;
    
    errorContainer.appendChild(errorBox);
    body.appendChild(errorContainer);
}

window.addEventListener('error', (event: ErrorEvent) => {
    displayError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    displayError(event);
});
// --- End Error Handling ---

try {
  // Initialize the application
  initUI();

  // Load and save the default scenario on initial load
  document.addEventListener('DOMContentLoaded', () => {
      const scenarioEl = document.getElementById('scenarioSelect') as HTMLSelectElement;
      if (scenarioEl) {
          const initialId = parseInt(scenarioEl.value);
          if (!isNaN(initialId)) {
              loadDemo(initialId);
              saveLayout();
          }
      }
  });
} catch(e) {
  displayError(e);
}
