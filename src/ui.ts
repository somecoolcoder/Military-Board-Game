/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import * as state from './state';
import * as C from './constants';
import * as game from './game';
import { Unit, Animation, Position, Scenario } from './types';
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

async function askAIAdvisor() {
    const chatInput = document.getElementById('aiChatInput') as HTMLInputElement;
    const sendButton = document.getElementById('aiChatSendBtn') as HTMLButtonElement;
    const chatHistory = document.getElementById('aiChatHistory') as HTMLElement;
    const userMessage = chatInput.value.trim();

    if (!userMessage || sendButton.disabled) return;

    chatInput.value = '';
    sendButton.disabled = true;
    sendButton.innerText = '...';

    // Display user message
    const userMessageEl = document.createElement('div');
    userMessageEl.className = 'user-message';
    userMessageEl.textContent = userMessage;
    chatHistory.appendChild(userMessageEl);

    // Display thinking message
    const aiMessageEl = document.createElement('div');
    aiMessageEl.className = 'ai-message';
    aiMessageEl.textContent = 'Analyzing...';
    chatHistory.appendChild(aiMessageEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const formatUnit = (u: Unit) => `  - ${u.type} (Team ${u.realTeam}) at (${u.x}, ${u.y}) with ${Math.round(u.hp)}/${u.maxHP} HP`;
        const teamAUnits = state.units.filter(u => u.alive && u.realTeam === 'A');
        const teamBUnits = state.units.filter(u => u.alive && u.realTeam === 'B');
        const obstacles = state.units.filter(u => u.alive && (u.team === 'OBSTACLE' || u.team === 'CORPSE'));

        const teamAUnitsStr = teamAUnits.length > 0 ? teamAUnits.map(formatUnit).join('\n') : '  - None';
        const teamBUnitsStr = teamBUnits.length > 0 ? teamBUnits.map(formatUnit).join('\n') : '  - None';
        const obstaclesStr = obstacles.length > 0 ? obstacles.map(u => `  - ${u.type} at (${u.x}, ${u.y})`).join('\n') : '  - None';
        
        const scenarioEl = document.getElementById('scenarioSelect') as HTMLSelectElement;
        const scenarioName = scenarioEl.options[scenarioEl.selectedIndex].text;
        
        const settingsData = {
            'Board Size': `${state.SIZE}x${state.SIZE}`,
            'Current Turn': state.turn,
            'Current Scenario': scenarioName,
            'Corpses Enabled': (document.getElementById('enableCorpses') as HTMLInputElement).checked,
            'Corpse Cleanup Enabled': (document.getElementById('secureArea') as HTMLInputElement).checked,
            'Team A Strategy': state.teamStrategy.A,
            'Team B Strategy': state.teamStrategy.B,
            'Unit Stats': {
                'Soldier HP': C.HP_SOLDIER, 'Soldier Damage': `${C.DAMAGE_MIN}-${C.DAMAGE_MAX}`, 'Soldier/Commando Bandages': C.MAX_HEAL_USES,
                'Rifleman Damage': `${C.RIFLE_MIN}-${C.RIFLE_MAX}`, 'Rifleman Max Targets': C.RIFLE_MAX_TARGETS, 'Rifleman Bandages': C.RIFLE_BANDAGES,
                'Marksman Damage': `${C.MARKSMAN_DAMAGE_MIN}-${C.MARKSMAN_DAMAGE_MAX}`, 'Marksman Range': C.MARKSMAN_RANGE,
                'Sniper Damage': `${C.SNIPER_DAMAGE_MIN}-${C.SNIPER_DAMAGE_MAX}`, 'Sniper Cooldown': C.SNIPER_COOLDOWN, 'Sniper Range': C.SNIPER_RANGE,
                'Commando HP': C.HP_COMMANDO, 'Commando Damage': `${C.COMMANDO_MIN}-${C.COMMANDO_MAX}`, 'Commando Max Targets': C.COMMANDO_MAX_TARGETS, 'Commando Cooldowns (Atk/Move)': `${C.COMMANDO_ATTACK_CD}/${C.COMMANDO_MOVE_CD}`,
                'Medic Heal': `${C.MEDIC_HEAL_MIN}-${C.MEDIC_HEAL_MAX}`, 'Medic Bandages': C.MEDIC_BANDAGES, 'Medic Heal Cooldown': C.MEDIC_HEAL_COOLDOWN,
                'Grenade Damage': `${C.GREN_MIN}-${C.GREN_MAX}`, 'Grenade Cooldown': C.GREN_COOLDOWN, 'Grenade Range': C.GRENADE_RANGE,
            }
        };

        const prompt = `You are a brilliant military tactics AI advisor. Analyze the complete battlefield state and provide expert advice. Be concise and tactical.

// Full Game State & Settings
const gameState = ${JSON.stringify({
    ...settingsData,
    teamA_units: teamAUnitsStr,
    teamB_units: teamBUnitsStr,
    obstacles_and_corpses: obstaclesStr,
}, null, 2)};

// Commander's Question
const question = "${userMessage}";

// Your Task
Provide your analysis based on all the data above. If asked for a strategy, first provide a two-sentence battlefield summary. Then, on a new line, provide your final verdict in the format: "Final Verdict: Use [Strategy Name] to [brief rationale]." The strategy must be one of: ${C.STRATEGIES.map(s => s.key).join(', ')}.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        
        const text = response.text;
        aiMessageEl.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    } catch (error) {
        console.error("Error with AI Advisor:", error);
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = 'An error occurred while contacting the AI.';
        aiMessageEl.replaceWith(errorEl);
    } finally {
        sendButton.disabled = false;
        sendButton.innerText = 'Send';
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

async function generateAIScenario() {
    const scenarioInput = document.getElementById('aiScenarioInput') as HTMLTextAreaElement;
    const generateButton = document.getElementById('aiScenarioGenerateBtn') as HTMLButtonElement;
    const userDescription = scenarioInput.value.trim();

    if (!userDescription || generateButton.disabled) return;

    generateButton.disabled = true;
    generateButton.innerText = 'Generating...';
    log('AI Scenario Generator: Thinking...');

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const unitCountSchema = {
            type: Type.OBJECT,
            properties: {
                sold: { type: Type.INTEGER, description: 'Number of Soldiers', nullable: true },
                snip: { type: Type.INTEGER, description: 'Number of Snipers', nullable: true },
                rif: { type: Type.INTEGER, description: 'Number of Riflemen', nullable: true },
                med: { type: Type.INTEGER, description: 'Number of Medics', nullable: true },
                gren: { type: Type.INTEGER, description: 'Number of Grenadiers', nullable: true },
                commando: { type: Type.INTEGER, description: 'Number of Commandos', nullable: true },
                civ: { type: Type.INTEGER, description: 'Number of Civilians', nullable: true },
                gen: { type: Type.INTEGER, description: 'Number of Generals (0 or 1)', nullable: true },
                spy: { type: Type.INTEGER, description: 'Number of Spies', nullable: true },
                mark: { type: Type.INTEGER, description: 'Number of Marksmen', nullable: true },
            }
        };

        const scenarioSchema = {
            type: Type.OBJECT,
            properties: {
                literalName: { type: Type.STRING, description: 'A serious, descriptive name for the scenario.' },
                literalLore: { type: Type.STRING, description: 'A short, serious backstory for the scenario (2-3 sentences).' },
                funnyName: { type: Type.STRING, description: 'A funny, creative name for the scenario.' },
                funnyLore: { type: Type.STRING, description: 'A short, funny, or absurd backstory for the scenario (2-3 sentences).' },
                size: { type: Type.INTEGER, description: 'The side length of the square game board. Must be between 5 and 15.' },
                A: { ...unitCountSchema, description: 'Unit counts for Team A.' },
                B: { ...unitCountSchema, description: 'Unit counts for Team B.' },
                strategies: {
                    type: Type.OBJECT, description: 'The starting strategies for each team.',
                    properties: { A: { type: Type.STRING }, B: { type: Type.STRING } },
                    required: ['A', 'B']
                },
                obstacles: {
                    type: Type.ARRAY, nullable: true,
                    description: 'A list of obstacles to place on the board. Do not place obstacles inside the default corner spawn zones.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, description: "The type of obstacle, must be 'wall' or 'corpse'." },
                            x: { type: Type.INTEGER }, y: { type: Type.INTEGER }
                        },
                        required: ['type', 'x', 'y']
                    }
                }
            },
            required: ['literalName', 'literalLore', 'funnyName', 'funnyLore', 'size', 'A', 'B', 'strategies']
        };

        const prompt = `You are an expert scenario designer for a turn-based strategy board game. Generate a complete, playable scenario based on the user's description. Output a single JSON object that strictly adheres to the provided schema.

Game Details:
- The game is played on a square grid. Team A (Military) vs. Team B (Bandits).
- Create a balanced and interesting scenario. Make forces unequal only if the prompt implies it (e.g., "last stand").
- Total units should be reasonable for the board size (e.g., 9x9 board: 15-25 units; 15x15 board: 40-60 units).
- Available Unit Types: sold, snip, rif, med, gren, commando, civ, gen (max 1/team), spy, mark.
- Available Strategies: ${C.STRATEGIES.map(s => s.key).join(', ')}.
- Obstacles ('wall', 'corpse') should be placed strategically. Do not place obstacles in the default corner spawn zones (top-left for Team A, bottom-right for Team B).

User's Scenario Description: "${userDescription}"

Generate the scenario now.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: scenarioSchema },
        });

        const scenario = JSON.parse(response.text) as Scenario;
        log('AI response received. Building scenario...');

        // Apply scenario
        (document.getElementById('inpSize') as HTMLInputElement).value = String(scenario.size);
        game.applySettings();
        
        const enforceZonesEl = document.getElementById('enforceZones') as HTMLInputElement;
        const wasEnforcing = enforceZonesEl.checked;
        if (wasEnforcing) enforceZonesEl.checked = false;
        
        if (scenario.obstacles && Array.isArray(scenario.obstacles)) {
            for (const obs of scenario.obstacles) {
                if(obs.x < scenario.size && obs.y < scenario.size) {
                    game.addUnitAt(obs.x, obs.y, obs.type, 'OBSTACLE');
                }
            }
        }
        if (wasEnforcing) enforceZonesEl.checked = true;

        const countsToUpdate = {
            'countA': scenario.A.sold, 'countAS': scenario.A.snip, 'countAR': scenario.A.rif, 'countAM': scenario.A.med, 'countAG': scenario.A.gren, 'countACo': scenario.A.commando, 'countAC': scenario.A.civ, 'countAGen': scenario.A.gen, 'countASpy': scenario.A.spy, 'countAMm': scenario.A.mark,
            'countB': scenario.B.sold, 'countBS': scenario.B.snip, 'countBR': scenario.B.rif, 'countBM': scenario.B.med, 'countBG': scenario.B.gren, 'countBCo': scenario.B.commando, 'countBC': scenario.B.civ, 'countBGen': scenario.B.gen, 'countBSpy': scenario.B.spy, 'countBMm': scenario.B.mark
        };
        for (const [id, count] of Object.entries(countsToUpdate)) {
            (document.getElementById(id) as HTMLInputElement).value = String(count || 0);
        }
        game.autoFillTeams();

        if (scenario.strategies) {
            state.teamStrategy.A = scenario.strategies.A;
            state.teamStrategy.B = scenario.strategies.B;
            updateStrategySelectsUI();
        }
        
        const lorePanel = document.getElementById('scenarioDetailsPanel');
        const loreEl = document.getElementById('scenarioLore');
        if (lorePanel && loreEl) {
            const lore = state.funnyScenarios ? scenario.funnyLore : scenario.literalLore;
            loreEl.innerText = lore;
            lorePanel.style.display = 'block';
        }

        const nameToLog = state.funnyScenarios ? scenario.funnyName : scenario.literalName;
        log(`AI-Generated Scenario Loaded: "${nameToLog}"`);
        saveLayout();
        
    } catch (error) {
        console.error("Error with AI Scenario Generator:", error);
        log('Error: The AI could not generate a valid scenario. Please try a different prompt.');
    } finally {
        generateButton.disabled = false;
        generateButton.innerText = 'Generate Scenario';
    }
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
    
    // AI Advisor
    document.getElementById('aiChatSendBtn')!.onclick = askAIAdvisor;
    document.getElementById('aiChatInput')!.addEventListener('keypress', (e) => { if (e.key === 'Enter') { askAIAdvisor(); } });

    // AI Scenario Generator
    document.getElementById('aiScenarioGenerateBtn')!.onclick = generateAIScenario;
    document.getElementById('aiScenarioInput')!.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateAIScenario(); } });


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