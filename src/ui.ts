/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as state from './state';
import * as C from './constants';
import * as game from './game';
import { Unit, Animation, Position } from './types';
import { normalizeUnitFields } from './utils';
import { loadDemo, updateScenarioDropdown, updateScenarioDetailsUI } from './scenarios';

// DOM Elements
const boardEl = document.getElementById('board')!;
const logEl = document.getElementById('log')!;

export function getCellEl(x: number,y: number) { return boardEl.children[y * state.SIZE + x] as HTMLElement; }

export function log(...args: any[]) {
  const s = Array.from(args).join(' ');
  logEl.innerHTML = s + "<br/>" + logEl.innerHTML;
}

function calculateTeamStrength(teamUnits: Unit[]): number {
    return teamUnits.reduce((total, u) => {
        const value = C.UNIT_VALUE[u.type] || 1;
        // Only count revealed spies in strength calculation for their real team
        const effectiveHp = (u.type === 'spy' && !u.spyRevealed) ? 0 : u.hp;
        return total + (effectiveHp * value);
    }, 0);
}

export function updateTideOfBattleBar() {
    const panel = document.getElementById('tideOfBattlePanel');
    if (!panel || panel.style.display === 'none') return;

    const teamAUnits = state.units.filter(u => u.alive && u.realTeam === 'A');
    const teamBUnits = state.units.filter(u => u.alive && u.realTeam === 'B');

    const strengthA = calculateTeamStrength(teamAUnits);
    const strengthB = calculateTeamStrength(teamBUnits);

    const totalStrength = strengthA + strengthB;
    
    let percentA = 50;
    if (totalStrength > 0) {
        percentA = (strengthA / totalStrength) * 100;
    }

    const tideAEl = document.getElementById('tideA') as HTMLElement;
    const tideBEl = document.getElementById('tideB') as HTMLElement;
    
    if (tideAEl) tideAEl.style.width = `${percentA}%`;
    if (tideBEl) tideBEl.style.width = `${100 - percentA}%`;
}

function renderAnimations() {
    const animationLayer = document.getElementById('animation-layer');
    if (!animationLayer) return;
    
    const smoothAnimationsEl = document.getElementById('smoothAnimations') as HTMLInputElement;
    if (!smoothAnimationsEl?.checked) {
        animationLayer.innerHTML = '';
        state.setEffects(state.effects.filter(e => e.type === 'explosion'));
        return;
    }

    const size = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--size')) || 48;
    const gap = 2;
    const cellSizeWithGap = size + gap;

    const getPixelPos = (pos: Position) => ({
        left: pos.x * cellSizeWithGap,
        top: pos.y * cellSizeWithGap
    });

    for (const anim of state.effects) {
        if (anim.type === 'explosion') continue; // Handled by cell class
        const el = document.createElement('div');
        
        switch (anim.type) {
            case 'projectile':
                if (!anim.from || !anim.to) continue;
                el.className = 'projectile';
                const fromPos = getPixelPos(anim.from);
                const toPos = getPixelPos(anim.to);

                const startX = fromPos.left + size / 2;
                const startY = fromPos.top + size / 2;
                const endX = toPos.left + size / 2;
                const endY = toPos.top + size / 2;
                
                const deltaX = endX - startX;
                const deltaY = endY - startY;
                const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
                
                el.style.left = `${startX - 8}px`; // half of new 16px width
                el.style.top = `${startY - 2}px`; // half of new 4px height
                el.style.transform = `rotate(${angle}deg)`;
                
                animationLayer.appendChild(el);

                requestAnimationFrame(() => {
                    el.style.left = `${endX - 8}px`;
                    el.style.top = `${endY - 2}px`;
                });

                setTimeout(() => el.remove(), 200);
                break;

            case 'death':
                if (!anim.at) continue;
                el.className = 'death-puff';
                el.innerText = '🪦';
                const deathPos = getPixelPos(anim.at);
                el.style.left = `${deathPos.left}px`;
                el.style.top = `${deathPos.top}px`;
                animationLayer.appendChild(el);
                setTimeout(() => el.remove(), 400);
                break;

            case 'heal':
                if (!anim.at) continue;
                el.className = 'heal-effect';
                el.innerText = '✚';
                const healPos = getPixelPos(anim.at);
                el.style.left = `${healPos.left}px`;
                el.style.top = `${healPos.top}px`;
                animationLayer.appendChild(el);
                setTimeout(() => el.remove(), 500);
                break;
            
            case 'bandage':
                if (!anim.at) continue;
                el.className = 'bandage-effect';
                el.innerText = '🩹';
                const bandagePos = getPixelPos(anim.at);
                el.style.left = `${bandagePos.left}px`;
                el.style.top = `${bandagePos.top}px`;
                animationLayer.appendChild(el);
                setTimeout(() => el.remove(), 500);
                break;
            
            case 'damage':
                if (!anim.at) continue;
                el.className = 'damage-flash';
                const damagePos = getPixelPos(anim.at);
                el.style.left = `${damagePos.left}px`;
                el.style.top = `${damagePos.top}px`;
                animationLayer.appendChild(el);
                setTimeout(() => el.remove(), 400);
                break;
        }
    }
    // Clear all non-explosion animations after processing
    state.setEffects(state.effects.filter(e => e.type === 'explosion'));
}

export function render(oldPositions: Map<string, {x: number, y: number}> = new Map()) {
    boardEl.innerHTML = '';
    const map = new Map();
    state.units.filter(u => u.alive).forEach(u => map.set(`${u.x},${u.y}`, u));
    (boardEl as HTMLElement).style.setProperty('--cols', String(state.SIZE));
    
    const effectMap = new Map<string, string>();
    for (const effect of state.effects) {
        if (effect.type === 'explosion' && effect.at) {
          effectMap.set(`${effect.at.x},${effect.at.y}`, effect.type);
        }
    }

    const highlightTeam = (state.selectedUnitType === 'spy') ? (state.activeTeam === 'A' ? 'B' : 'A') : state.activeTeam;
    const z = game.zoneForTeam(highlightTeam);
    const highlightActiveZone = (document.getElementById('highlightZone') as HTMLInputElement).checked;

    for (let y = 0; y < state.SIZE; y++) {
        for (let x = 0; x < state.SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell ' + ((x + y) % 2 ? 'dark' : 'light');
            if (highlightActiveZone && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) {
                if (state.selectedUnitType === 'spy') cell.classList.add('highlight-red'); else cell.classList.add('highlight-yellow');
            }
            const u = map.get(`${x},${y}`);
            if (u) {
                const d = document.createElement('div');
                d.className = 'unit ' + u.type;
                
                let label = '';
                if (u.type === 'corpse') { label = '☠️'; } 
                else if (u.type === 'wall') { label = '🧱'; }
                else if (u.type === 'spy' && !u.spyRevealed) { label = '?'; } 
                else { const parts = u.id.split('_'); label = u.team + parts[1]; }
                
                let statusText;
                if (u.type === 'wall' || u.type === 'corpse') {
                    statusText = `${Math.max(0, Math.round(u.hp))}/${u.maxHP}`;
                } else if ((u.type === 'sniper' && u.cooldown > 0) || (u.type === 'gren' && u.grenCooldown > 0) || (u.type === 'spy' && u.spyCooldown > 0)) {
                  const cdVal = (u.type === 'sniper') ? u.cooldown : (u.type === 'gren') ? u.grenCooldown : u.spyCooldown;
                  statusText = 'CD:' + cdVal;
                } else {
                  statusText = `${Math.max(0, Math.round(u.hp))}/${u.maxHP}`;
                }
                const infoLine = document.createElement('div'); infoLine.style.fontSize = '10px'; infoLine.innerText = label;
                const hpLine = document.createElement('div'); hpLine.style.fontSize = '9px'; hpLine.innerText = statusText;
                d.appendChild(infoLine); d.appendChild(hpLine);
                const hpbar = document.createElement('div'); hpbar.className = 'hp-bar';
                const hpfill = document.createElement('div'); hpfill.className = 'hp';
                hpfill.style.width = Math.max(0, Math.round((u.hp / u.maxHP) * 100)) + '%';
                hpbar.appendChild(hpfill);
                d.appendChild(hpbar);
                
                const smoothAnimationsEl = document.getElementById('smoothAnimations') as HTMLInputElement;
                if (smoothAnimationsEl?.checked) {
                    const oldPos = oldPositions.get(u.id);
                    if (oldPos && (oldPos.x !== u.x || oldPos.y !== u.y)) {
                        const size = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--size')) || 48;
                        const gap = 2;
                        const cellSizeWithGap = size + gap;
            
                        const deltaX = (u.x - oldPos.x) * cellSizeWithGap;
                        const deltaY = (u.y - oldPos.y) * cellSizeWithGap;
            
                        // Get current speed setting to make animation duration dynamic
                        const speed = parseInt((document.getElementById('speed') as HTMLInputElement).value, 10);
                        // Make animation slightly shorter than the step interval to ensure it finishes.
                        // Cap at a reasonable maximum, e.g., 400ms.
                        const duration = Math.min(speed * 0.9, 400);

                        d.style.transition = `transform ${duration}ms ease-out`;
                        d.style.transform = `translate(${-deltaX}px, ${-deltaY}px)`;
                        
                        requestAnimationFrame(() => {
                            d.style.transform = 'translate(0, 0)';
                        });
                    }
                }
                cell.appendChild(d);
            }
            if (state.gameState === 'REDEPLOYING') {
                for (const [unitId, targetPos] of state.redeployTargets.entries()) {
                    if (targetPos.x === x && targetPos.y === y) {
                        const unit = state.units.find(u => u.id === unitId);
                        if (unit) {
                            const targetMarker = document.createElement('div');
                            targetMarker.className = `redeploy-target team-${unit.team.toLowerCase()}`;
                            cell.appendChild(targetMarker);
                        }
                        break; 
                    }
                }
            }
            
            const effectType = effectMap.get(`${x},${y}`);
            if (effectType === 'explosion') {
                cell.classList.add('explosion');
            }

            boardEl.appendChild(cell);
        }
    }
    document.getElementById('turnInfo')!.innerText = 'Turn: ' + state.turn;
    document.getElementById('teamAAlive')!.innerText = String(state.units.filter(u => u.alive && u.team === 'A').length);
    document.getElementById('teamBAlive')!.innerText = String(state.units.filter(u => u.alive && u.team === 'B').length);
    document.getElementById('teamACas')!.innerText = String(state.casualties.A);
    document.getElementById('teamBCas')!.innerText = String(state.casualties.B);
    updateTideOfBattleBar();
    renderAnimations();
}

function setSelected(t: string) { 
    state.setSelectedUnitType(t);
    const ids = ['btnSoldier','btnSniper','btnRifle','btnMedic','btnGren','btnCommando','btnCiv','btnGeneral','btnSpy','btnMarksman','btnRemove','btnWall','btnCorpse']; 
    ids.forEach(id=>{
        const el=document.getElementById(id); 
        if(!el) return; 
        el.classList.toggle('highlight', id.toLowerCase().includes(t==='mil'?'soldier':t));
    }); 
    render();
}

export function stopAuto() { 
    if (state.autoInterval) { 
        clearInterval(state.autoInterval); 
        state.setAutoInterval(null);
        document.getElementById('playBtn')!.innerText = 'Auto'; 
    } 
}
export function startAuto() { 
    if (state.autoInterval) return; 
    const interval = setInterval(game.step, parseInt((document.getElementById('speed') as HTMLInputElement).value));
    state.setAutoInterval(interval);
    document.getElementById('playBtn')!.innerText = 'Stop'; 
}

export function saveLayout() {
  if (typeof state.units === 'undefined' || state.units == null) {
    log('saveLayout: no units to save.');
    return;
  }
  const layout = JSON.parse(JSON.stringify(state.units));
  if (Array.isArray(layout)) layout.forEach(u => normalizeUnitFields(u));
  state.setSavedLayout(layout);
  log('Layout saved (clone).');
}

function clearTeams() { 
    state.setUnits([]); 
    state.setCasualties({ A: 0, B: 0 }); 
    state.setTurn(0); 
    state.setGameState('COMBAT'); 
    state.redeployTargets.clear(); 
    state.setEffects([]);
    document.getElementById('animation-layer')!.innerHTML = '';
    render(); 
    log('Teams cleared.'); 
}

export function updateStrategySelectsUI() {
    const a = document.getElementById('stratA') as HTMLSelectElement, b = document.getElementById('stratB') as HTMLSelectElement; 
    if (a) a.value = state.teamStrategy.A; 
    if (b) b.value = state.teamStrategy.B; 
    updateStrategyDisplays();
}

export function updateStrategyDisplays() {
    const aName = document.getElementById('teamAStr'), aDesc = document.getElementById('teamAStrDesc');
    const bName = document.getElementById('teamBStr'), bDesc = document.getElementById('teamBStrDesc');
    const sa = C.STRATEGIES.find(x => x.key === state.teamStrategy.A); 
    const sb = C.STRATEGIES.find(x => x.key === state.teamStrategy.B);
    if (aName) aName.innerText = state.teamStrategy.A; 
    if (aDesc && sa) aDesc.innerText = sa.desc; 
    if (bName) bName.innerText = state.teamStrategy.B; 
    if (bDesc && sb) bDesc.innerText = sb.desc;
}

function populateStrategySelects() {
    const a = document.getElementById('stratA') as HTMLSelectElement, b = document.getElementById('stratB') as HTMLSelectElement; 
    if (!a || !b) return; 
    a.innerHTML = ''; b.innerHTML = '';
    for (const s of C.STRATEGIES) { 
        const opt = document.createElement('option'); 
        opt.value = s.key; 
        opt.textContent = s.label; 
        a.appendChild(opt); 
        const opt2 = opt.cloneNode(true); 
        b.appendChild(opt2 as Node); 
    }
    updateStrategySelectsUI();
    a.onchange = () => { 
        state.teamStrategy.A = a.value; 
        const sd = C.STRATEGIES.find(x => x.key === a.value); 
        log(`Team A strategy set to ${a.value}: ${sd ? sd.desc : ''}`); 
        updateStrategyDisplays(); 
    };
    b.onchange = () => { 
        state.teamStrategy.B = b.value; 
        const sd = C.STRATEGIES.find(x => x.key === b.value); 
        log(`Team B strategy set to ${b.value}: ${sd ? sd.desc : ''}`); 
        updateStrategyDisplays(); 
    };
}

export function initUI() {
    // Palette buttons
    ['btnSoldier','btnSniper','btnRifle','btnMedic','btnGren','btnCommando','btnCiv','btnGeneral','btnSpy','btnMarksman','btnRemove','btnWall','btnCorpse'].forEach(id=>{
        const el=document.getElementById(id); 
        if(el) el.onclick=()=>{
            let t=id.replace('btn','').toLowerCase(); 
            if(t==='soldier') t='mil'; 
            if(t==='remove') t='remove'; 
            setSelected(t);
        };
    });

    // Board clicks
    boardEl.addEventListener('click', function (e) {
      const cell = (e.target as HTMLElement).closest('.cell'); if (!cell) return;
      const idx = Array.from(boardEl.children).indexOf(cell);
      const x = idx % state.SIZE, y = Math.floor(idx / state.SIZE);
      const existing = state.units.find(u => u.alive && u.x === x && u.y === y); if (existing) { game.removeUnitAt(x, y); return; }
      if (state.selectedUnitType === 'remove') return;
      const isObstacle = ['wall', 'corpse'].includes(state.selectedUnitType);
      const teamToUse = isObstacle ? 'OBSTACLE' : state.activeTeam;
      const a = game.addUnitAt(x, y, state.selectedUnitType, teamToUse);
      if (!a) log('Cannot place unit at', x, y, '(occupied or outside zone)');
      else render();
    });

    // Control buttons
    document.getElementById('stepBtn')!.onclick = () => game.step();
    document.getElementById('playBtn')!.onclick = () => { if (state.autoInterval) stopAuto(); else startAuto(); };
    document.getElementById('clearBtn')!.onclick = () => { state.setUnits([]); state.setCasualties({ A: 0, B: 0 }); render(); log('Map cleared.'); };
    document.getElementById('saveLayoutBtn')!.onclick = () => saveLayout();
    document.getElementById('applySettingsBtn')!.onclick = () => game.applySettings();
    document.getElementById('autoFillBtn')!.onclick = () => game.autoFillTeams();
    document.getElementById('clearTeamsBtn')!.onclick = () => clearTeams();
    document.getElementById('resetBtn')!.onclick = () => {
      if (state.savedLayout) {
        state.setUnits(JSON.parse(JSON.stringify(state.savedLayout)));
        for (const u of state.units) normalizeUnitFields(u);
        state.setCasualties({ A: 0, B: 0 }); 
        state.setTurn(0); 
        state.setGameState('COMBAT'); 
        state.redeployTargets.clear(); 
        state.effects.length = 0;
        document.getElementById('animation-layer')!.innerHTML = '';
        render(); 
        log('Layout restored from saved.');
      } else { log('No saved layout to restore.'); }
    };
    
    // Settings Checkboxes
    const enableCorpsesEl = document.getElementById('enableCorpses') as HTMLInputElement;
    const secureAreaEl = document.getElementById('secureArea') as HTMLInputElement;
    enableCorpsesEl.addEventListener('change', () => {
        secureAreaEl.disabled = !enableCorpsesEl.checked;
        if (enableCorpsesEl.checked) {
            secureAreaEl.checked = true; // Default to on when corpses are enabled
        } else {
            secureAreaEl.checked = false;
        }
    });

    const showTideEl = document.getElementById('showTideOfBattle') as HTMLInputElement;
    const tidePanel = document.getElementById('tideOfBattlePanel') as HTMLElement;
    showTideEl.addEventListener('change', () => {
        tidePanel.style.display = showTideEl.checked ? 'block' : 'none';
        updateTideOfBattleBar();
    });

    const funnyScenariosEl = document.getElementById('funnyScenarios') as HTMLInputElement;
    if (funnyScenariosEl) {
        funnyScenariosEl.addEventListener('change', () => {
            state.setFunnyScenarios(funnyScenariosEl.checked);
            updateScenarioDropdown();
            const scenarioEl = document.getElementById('scenarioSelect') as HTMLSelectElement;
            if (scenarioEl) {
                const currentId = parseInt(scenarioEl.value);
                if (!isNaN(currentId)) {
                    updateScenarioDetailsUI(currentId);
                }
            }
        });
    }

    // Selects
    (document.getElementById('activeTeam') as HTMLSelectElement).onchange = e => { state.setActiveTeam((e.target as HTMLSelectElement).value); render(); };
    document.getElementById('zoneTypeSelect')!.addEventListener('change', () => render());
    
    const scenarioEl = document.getElementById('scenarioSelect') as HTMLSelectElement;
    if (scenarioEl) {
        scenarioEl.addEventListener('change', (e) => {
            const id = parseInt((e.target as HTMLSelectElement).value);
            if (!isNaN(id)) {
                loadDemo(id);
                saveLayout();
            }
        });
    }

    // Initial state
    populateStrategySelects();
    updateStrategyDisplays();
    setSelected('mil');
    updateScenarioDropdown();
    render();
}