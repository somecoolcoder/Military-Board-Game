/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { initUI } from './src/ui';
import { loadDemo } from './src/scenarios';
import { saveLayout } from './src/ui';

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
