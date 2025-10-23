/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { addUnitAt, autoFillTeams, applySettings } from './game';
import { render, log, updateStrategySelectsUI, updateStrategyDisplays } from './ui';
import { Scenario } from './types';
import * as state from './state';
import * as C from './constants';

const SCENARIOS: { [key: number]: Scenario } = {
  1: {"literalName":"Civilian Riot","literalLore":"Team A's peacekeepers must hold the line against an overwhelming force of rioters from Team B who have taken over the city streets.","funnyName":"The Grand Festival","funnyLore":"Team B, a group of overly-enthusiastic festival-goers, are trying to share their joy with Team A's peacekeepers. Unfortunately, their 'joy' involves throwing rocks and breaking things.","size":9,A:{"snip":2,"med":2},B:{"civ":10},"strategies":{"A":"Defensive Hold","B":"Aggressive Swarm"},"obstacles":[{"type":"wall","x":0,"y":7},{"type":"wall","x":0,"y":8},{"type":"wall","x":1,"y":7},{"type":"wall","x":1,"y":8},{"type":"wall","x":7,"y":0},{"type":"wall","x":8,"y":0},{"type":"wall","x":7,"y":1},{"type":"wall","x":8,"y":1}]},
  2: {"literalName":"Forest Skirmish","literalLore":"Team A's sharpshooters have taken up positions in a dense forest, but Team B is moving in to flush them out.","funnyName":"Birdwatching Expedition","funnyLore":"Team A's ornithologists have found the perfect spot to observe rare birds. Team B, a rival birdwatching club, is determined to claim the scenic viewpoint for themselves, using aggressive negotiation tactics.","size":7,A:{"snip":3,"med":1},B:{"sold":6},"strategies":{"A":"Kite & Shoot","B":"Overwhelm"}},
  3: {"literalName":"Urban Ambush","literalLore":"Team A is lying in wait to ambush a larger patrol from Team B as they move through a tight urban corridor.","funnyName":"Surprise Party","funnyLore":"Team A has prepared an elaborate surprise party for Team B, complete with explosive, oversized party poppers. Team B is about to get a welcome they'll never forget.","size":9,A:{"sold":2,"med":1,"gren":3},B:{"sold":8},"strategies":{"A":"Ambush","B":"Aggressive Swarm"}},
  4: {"literalName":"Infiltration","literalLore":"Team B has sent several spies to infiltrate Team A's command post. Team A must identify and eliminate the threat before their General is compromised.","funnyName":"Team Building Exercise","funnyLore":"To promote inter-departmental cohesion, Team B has sent its agents to join Team A for a trust-building exercise. Team A suspects their new colleagues' methods are a bit... unorthodox.","size":9,A:{"sold":3,"gen":1},B:{"sold":6,"spy":3},"strategies":{"A":"Focus Fire","B":"Ambush"}},
  5: {"literalName":"VIP Escort","literalLore":"Team A must form a protective phalanx around their General and escort them through hostile territory controlled by Team B.","funnyName":"The Party Escort","funnyLore":"Team A forms the world's most disciplined conga line to protect their celebrity General. Team B, feeling left out of the fun, is trying to crash the party and break up the dance.","size":11,A:{"sold":8,"med":2,"gen":1},B:{"sold":6,"snip":1,"gren":2,"mark":1},"strategies":{"A":"Phalanx","B":"Aggressive Swarm"}},
  6: {"literalName":"Urban Combat","literalLore":"A balanced skirmish between Team A and Team B in a ruined city center, where cover and ambush opportunities are plentiful.","funnyName":"Urban Renewal Project","funnyLore":"Team A and Team B are rival construction crews with very different ideas about urban planning. Negotiations have broken down, and they've resorted to using heavy equipment... on each other.","size":9,A:{"sold":4,"snip":1,"rif":2,"med":1,"gren":1,"civ":2,"mark":1},B:{"sold":5,"snip":1,"rif":1,"gren":1,"civ":2,"spy":1},"strategies":{"A":"Balanced","B":"Ambush"},"obstacles":[{"type":"wall","x":2,"y":4},{"type":"wall","x":3,"y":4},{"type":"wall","x":4,"y":4},{"type":"corpse","x":6,"y":2},{"type":"corpse","x":1,"y":7},{"type":"corpse","x":3,"y":5}]},
  7: {"literalName":"Sniper Duel","literalLore":"A high-stakes engagement between two elite sniper teams, Team A and Team B, across an open field. Support units are minimal.","funnyName":"A Friendly Wager","funnyLore":"On a windswept plateau, Team A's elite marksmen are locked in a deadly standoff with Team B's sharpshooters. They're just settling a bet over who has to buy lunch.","size":8,A:{"snip":2,"med":2},B:{"snip":2,"med":2,"gen":1},"strategies":{"A":"Kite & Shoot","B":"Kite & Shoot"}},
  8: {"literalName":"Last Stand","literalLore":"A small, well-defended contingent from Team A must hold their position against a massive swarm of attackers from Team B.","funnyName":"Extreme Camping","funnyLore":"Team A is on a company retreat, but they've forgotten the marshmallows. Team B, a group of overly helpful park rangers, is approaching to 'assist' them with their campsite setup.","size":9,A:{"sold":2,"med":1,"gen":1},B:{"sold":10},"strategies":{"A":"Defensive Hold","B":"Overwhelm"},"obstacles":[{"type":"wall","x":3,"y":0},{"type":"wall","x":3,"y":1},{"type":"wall","x":3,"y":2},{"type":"wall","x":0,"y":3},{"type":"wall","x":1,"y":3},{"type":"wall","x":2,"y":3},{"type":"wall","x":3,"y":3},{"type":"corpse","x":8,"y":0},{"type":"corpse","x":5,"y":1},{"type":"corpse","x":7,"y":3},{"type":"corpse","x":0,"y":5},{"type":"corpse","x":2,"y":8}]},
  9: {"literalName":"Guerilla Warfare","literalLore":"Team A is using hit-and-run tactics to ambush a larger, less mobile force from Team B in a complex environment.","funnyName":"Hide and Seek","funnyLore":"Team A are the reigning regional champions of hide-and-seek. An overzealous Team B is 'it', and they are very, very determined to find everyone.","size":11,A:{"sold":3,"snip":1,"med":1,"gren":2},B:{"sold":9,"spy":1},"strategies":{"A":"Ambush","B":"Aggressive Swarm"}},
  10: {"literalName":"All-Out War","literalLore":"Two massive, combined-arms armies from Team A and Team B clash in a large-scale, decisive battle.","funnyName":"A Minor Disagreement","funnyLore":"Team A and Team B are having a slight difference of opinion regarding the last slice of pizza. The discussion has escalated into what experts are calling a 'full-scale conflict.'","size":13,A:{"sold":8,"snip":2,"rif":3,"med":2,"gren":3,"gen":1,"spy":2,"commando":1,"mark":2},B:{"sold":10,"snip":2,"rif":2,"med":1,"gren":2,"gen":1,"spy":2,"commando":1,"mark":2},"strategies":{"A":"Aggressive Swarm","B":"Aggressive Swarm"}},
  11: {"literalName":"Desert Siege","literalLore":"Team A is defending a fortified position in the desert against a determined assault from Team B's forces.","funnyName":"Sandcastle Contest","funnyLore":"Team A has built a magnificent sandcastle fortress for the annual competition. Team B, believing their own sandcastle design is superior, is launching an aggressive critique with explosives.","size":11,A:{"sold":6,"snip":2,"med":1,"gen":1},B:{"sold":8,"gren":2,"spy":1},"strategies":{"A":"Defensive Hold","B":"Overwhelm"},"obstacles":[{"type":"wall","x":0,"y":5},{"type":"wall","x":1,"y":5},{"type":"wall","x":2,"y":5},{"type":"wall","x":5,"y":2},{"type":"wall","x":5,"y":3},{"type":"corpse","x":2,"y":7},{"type":"corpse","x":6,"y":0},{"type":"corpse","x":7,"y":2},{"type":"corpse","x":0,"y":6}]},
  12: {"literalName":"Bridge Crossing","literalLore":"Team A must hold a narrow bridge chokepoint against a numerically superior Team B attempting to force a crossing.","funnyName":"The Tollbooth Dispute","funnyLore":"Team B operates a highly unregulated tollbooth with exorbitant fees. Team A refuses to pay for 'premium air' and is attempting to cross the bridge by force.","size":9,A:{"sold":5,"snip":1,"rif":2,"gren":1},B:{"sold":7,"rif":2,"med":1},"strategies":{"A":"Phalanx","B":"Aggressive Swarm"},"obstacles":[{"type":"wall","x":6,"y":0},{"type":"wall","x":6,"y":1},{"type":"wall","x":6,"y":2},{"type":"wall","x":6,"y":3},{"type":"wall","x":6,"y":4},{"type":"wall","x":7,"y":0},{"type":"wall","x":7,"y":1},{"type":"wall","x":7,"y":2},{"type":"wall","x":7,"y":3},{"type":"wall","x":7,"y":4},{"type":"wall","x":8,"y":0},{"type":"wall","x":8,"y":1},{"type":"wall","x":8,"y":2},{"type":"wall","x":8,"y":3},{"type":"wall","x":8,"y":4},{"type":"wall","x":5,"y":3},{"type":"wall","x":5,"y":4},{"type":"wall","x":0,"y":4},{"type":"wall","x":0,"y":5},{"type":"wall","x":0,"y":6},{"type":"wall","x":0,"y":7},{"type":"wall","x":0,"y":8},{"type":"wall","x":1,"y":4},{"type":"wall","x":1,"y":5},{"type":"wall","x":1,"y":6},{"type":"wall","x":1,"y":7},{"type":"wall","x":1,"y":8},{"type":"wall","x":2,"y":4},{"type":"wall","x":2,"y":5},{"type":"wall","x":2,"y":6},{"type":"wall","x":2,"y":7},{"type":"wall","x":2,"y":8},{"type":"wall","x":3,"y":4},{"type":"wall","x":3,"y":5}]},
  13: {"literalName":"Stealth Operation","literalLore":"A small, elite squad from Team A must infiltrate Team B's territory without raising an alarm.","funnyName":"Late-Night Snack Run","funnyLore":"Team A's stealth operatives are attempting a daring raid on Team B's kitchen for the last of the good snacks. Team B was saving those for later and is not amused by the disturbance.","size":7,A:{"sold":3,"gen":1,"spy":2},B:{"sold":5,"snip":1,"gren":1},"strategies":{"A":"Ambush","B":"Balanced"}},
  14: {"literalName":"Pitched Battle","literalLore":"Team A's smaller, combined-arms group must use careful positioning and ranged attacks to hold off a larger, more powerful force from Team B advancing across an open field.","funnyName":"Scenic Hike","funnyLore":"Team A is enjoying a scenic hike through the mountains. Team B, a rival hiking group, insists they are going the wrong way and is trying to 'correct' their path with overwhelming force.","size":11,A:{"sold":4,"snip":1,"med":1,"gren":2,"mark":1},B:{"sold":6,"snip":2,"gen":1},"strategies":{"A":"Kite & Shoot","B":"Overwhelm"}},
  15: {"literalName":"Large-Scale Battle","literalLore":"Two well-equipped and balanced forces, Team A and Team B, engage in a conventional battle on an open field.","funnyName":"Tour Group Scuffle","funnyLore":"Two rival tour groups, Team A and Team B, have booked the same historical monument at the same time. The dispute over who gets to take pictures first has turned violent.","size":13,A:{"sold":10,"snip":2,"rif":2,"med":2,"gren":2,"gen":1,"spy":1},B:{"sold":11,"snip":2,"rif":3,"med":1,"gren":2,"gen":1,"spy":1},"strategies":{"A":"Balanced","B":"Aggressive Swarm"}},
  16: {"literalName":"Village Defense","literalLore":"Team A, a mix of regular troops and civilian militia, must defend a village from a large-scale invasion by Team B's army.","funnyName":"Unsolicited Renovation","funnyLore":"Team B, an aggressive home renovation company, is insistent on 'upgrading' the village. Team A, the local homeowners' association, vehemently objects to the proposed changes.","size":11,A:{"sold":5,"med":2,"civ":7,"gen":1},B:{"sold":20},"strategies":{"A":"Defensive Hold","B":"Aggressive Swarm"}},
  17: {"literalName":"Armored Assault","literalLore":"Team A's elite Commandos lead a lightning-fast assault to break through Team B's defensive lines.","funnyName":"Express Delivery","funnyLore":"Team A is a courier service that promises delivery in 30 minutes or less, no matter what. Team B is the unfortunate recipient of a package they didn't order and are refusing to sign for it.","size":13,A:{"sold":10,"commando":2,"rif":2,"med":1,"gren":2,"gen":1},B:{"sold":9,"rif":1,"gren":1,"spy":1,"mark":1},"strategies":{"A":"Aggressive Swarm","B":"Ambush"}},
  18: {"literalName":"Symmetrical Warfare","literalLore":"Two identically equipped teams, Team A and Team B, face off in a test of pure tactical skill.","funnyName":"Secret Santa Exchange","funnyLore":"It's the annual Secret Santa gift exchange, but paranoia is rampant. Both Team A and Team B suspect the other side is trying to re-gift last year's presents.","size":9,A:{"sold":6,"rif":1,"med":1,"spy":1},B:{"sold":6,"rif":1,"med":1,"spy":1},"strategies":{"A":"Ambush","B":"Ambush"}},
  19: {"literalName":"Horde Defense","literalLore":"A small, well-equipped team of defenders from Team A must survive against an impossibly large horde of basic infantry from Team B.","funnyName":"Free Hugs Campaign","funnyLore":"Team B is on a mission to give everyone a free hug, all at once. Team A is not a fan of physical contact and is desperately trying to maintain their personal space.","size":15,A:{"sold":10,"snip":5,"med":2,"gren":2},B:{"sold":60},"strategies":{"A":"Kite & Shoot","B":"Aggressive Swarm"}},
  20: {"literalName":"Commando Strike","literalLore":"An elite commando squad from Team A must infiltrate and neutralize Team B's command structure, which is protected by a defensive garrison.","funnyName":"Aggressive Sales Pitch","funnyLore":"Team A's elite commandos are trying to sell an extended warranty for their General's vehicle to Team B. Team B's defenders are doing everything they can to stop the aggressive sales pitch.","size":11,A:{"commando":2,"med":1},B:{"sold":8,"snip":2,"gen":1,"mark":1},"strategies":{"A":"Focus Fire","B":"Defensive Hold"}}
};

export function updateScenarioDropdown() {
    const scenarioEl = document.getElementById('scenarioSelect') as HTMLSelectElement;
    if (!scenarioEl) return;
    for (let i = 0; i < scenarioEl.options.length; i++) {
        const option = scenarioEl.options[i];
        const scenarioId = parseInt(option.value);
        if (SCENARIOS[scenarioId]) {
            const scenario = SCENARIOS[scenarioId];
            option.text = state.funnyScenarios 
                ? `${scenarioId} — ${scenario.funnyName}`
                : `${scenarioId} — ${scenario.literalName}`;
        }
    }
}

export function updateScenarioDetailsUI(scenarioId: number) {
    const s = SCENARIOS[scenarioId];
    if (!s) return;

    const lorePanel = document.getElementById('scenarioDetailsPanel');
    const loreEl = document.getElementById('scenarioLore');

    if (lorePanel && loreEl) {
        const lore = state.funnyScenarios ? s.funnyLore : s.literalLore;
        if (lore) {
            loreEl.innerText = lore;
            lorePanel.style.display = 'block';
        } else {
            lorePanel.style.display = 'none';
        }
    }
}

export function loadDemo(scenarioId: number) {
    const lorePanel = document.getElementById('scenarioDetailsPanel');

    if (!scenarioId) {
        // original demo fallback
        state.setUnits([]);
        state.setCasualties({ A: 0, B: 0 });
        state.setTurn(0);
        addUnitAt(0, 0, 'general', 'A');
        addUnitAt(1, 0, 'mil', 'A');
        addUnitAt(2, 0, 'sniper', 'A');
        addUnitAt(0, 1, 'medic', 'A');
        addUnitAt(state.SIZE - 1, state.SIZE - 1, 'general', 'B');
        addUnitAt(state.SIZE - 2, state.SIZE - 1, 'mil', 'B');
        addUnitAt(state.SIZE - 3, state.SIZE - 1, 'gren', 'B');
        addUnitAt(state.SIZE - 1, state.SIZE - 2, 'rifle', 'B');
        if (lorePanel) lorePanel.style.display = 'none';
        render();
        log('Demo loaded.');
        return;
    }
    const s = SCENARIOS[scenarioId];
    if (!s) { log('Scenario not found'); return; }

    updateScenarioDetailsUI(scenarioId);

    // set board size (and UI input)
    (document.getElementById('inpSize') as HTMLInputElement).value = String(s.size);
    applySettings(); // apply and reset board with new SIZE
    
    // Load obstacles first
    if (s.obstacles && Array.isArray(s.obstacles)) {
        log(`Loading ${s.obstacles.length} obstacles...`);
        const wasEnforcing = (document.getElementById('enforceZones') as HTMLInputElement).checked;
        if (wasEnforcing) (document.getElementById('enforceZones') as HTMLInputElement).checked = false;
        for (const obs of s.obstacles) {
            addUnitAt(obs.x, obs.y, obs.type, 'OBSTACLE');
        }
        if (wasEnforcing) (document.getElementById('enforceZones') as HTMLInputElement).checked = true;
    }

    // set counts into the auto-fill inputs
    (document.getElementById('countA') as HTMLInputElement).value = String(s.A.sold || 0);
    (document.getElementById('countAS') as HTMLInputElement).value = String(s.A.snip || 0);
    (document.getElementById('countAR') as HTMLInputElement).value = String(s.A.rif || 0);
    (document.getElementById('countAM') as HTMLInputElement).value = String(s.A.med || 0);
    (document.getElementById('countAG') as HTMLInputElement).value = String(s.A.gren || 0);
    (document.getElementById('countACo') as HTMLInputElement).value = String(s.A.commando || 0);
    (document.getElementById('countAC') as HTMLInputElement).value = String(s.A.civ || 0);
    (document.getElementById('countAGen') as HTMLInputElement).value = String(s.A.gen || 0);
    (document.getElementById('countASpy') as HTMLInputElement).value = String(s.A.spy || 0);
    (document.getElementById('countAMm') as HTMLInputElement).value = String(s.A.mark || 0);
    
    (document.getElementById('countB') as HTMLInputElement).value = String(s.B.sold || 0);
    (document.getElementById('countBS') as HTMLInputElement).value = String(s.B.snip || 0);
    (document.getElementById('countBR') as HTMLInputElement).value = String(s.B.rif || 0);
    (document.getElementById('countBM') as HTMLInputElement).value = String(s.B.med || 0);
    (document.getElementById('countBG') as HTMLInputElement).value = String(s.B.gren || 0);
    (document.getElementById('countBCo') as HTMLInputElement).value = String(s.B.commando || 0);
    (document.getElementById('countBC') as HTMLInputElement).value = String(s.B.civ || 0);
    (document.getElementById('countBGen') as HTMLInputElement).value = String(s.B.gen || 0);
    (document.getElementById('countBSpy') as HTMLInputElement).value = String(s.B.spy || 0);
    (document.getElementById('countBMm') as HTMLInputElement).value = String(s.B.mark || 0);
    
    autoFillTeams();
    
    if (s.strategies) {
      if (s.strategies.A) state.teamStrategy.A = s.strategies.A;
      if (s.strategies.B) state.teamStrategy.B = s.strategies.B;
      updateStrategySelectsUI();
      updateStrategyDisplays();
      const sa = C.STRATEGIES.find(x => x.key === state.teamStrategy.A);
      const sb = C.STRATEGIES.find(x => x.key === state.teamStrategy.B);
      log(`Scenario applied strategies -> Team A: ${state.teamStrategy.A}${sa ? ' — ' + sa.desc : ''}, Team B: ${state.teamStrategy.B}${sb ? ' — ' + sb.desc : ''}`);
    }
    const nameToLog = state.funnyScenarios ? s.funnyName : s.literalName;
    log('Scenario loaded:', nameToLog);
}