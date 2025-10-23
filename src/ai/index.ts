/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../types';
import * as state from '../state';
import { moveToTarget } from '../pathfinding';
import { isStalemated } from './utils';
import { aggressiveSwarmDecide } from './strategies/aggressiveSwarmDecide';
import { soldierDecide } from './unitDecisions/soldierDecide';
import { sniperDecide } from './unitDecisions/sniperDecide';
import { grenadierDecide } from './unitDecisions/grenadierDecide';
import { medicDecide } from './unitDecisions/medicDecide';
import { generalDecide } from './unitDecisions/generalDecide';
import { spyDecide } from './unitDecisions/spyDecide';
import { commandoDecide } from './unitDecisions/commandoDecide';
import { civilianDecide } from './unitDecisions/civilianDecide';
import { marksmanDecide } from './unitDecisions/marksmanDecide';


function forceAttackPlan(u: Unit, all: Unit[]) { return aggressiveSwarmDecide(u, all); }

export function planCombat(alive: Unit[]) {
    // ... setup targets for strategies like Focus Fire, Overwhelm
    for (const u of alive) {
        if (u.team !== 'A' && u.team !== 'B') { u._plan = {}; continue; }
        if (isStalemated(u)) { u._plan = forceAttackPlan(u, state.units); continue; }
        if (u.type === 'sniper') u._plan = sniperDecide(u, state.units);
        else if (u.type === 'gren') u._plan = grenadierDecide(u, state.units);
        else if (u.type === 'medic') u._plan = medicDecide(u, state.units);
        else if (u.type === 'general') u._plan = generalDecide(u, state.units);
        else if (u.type === 'spy') u._plan = spyDecide(u, state.units);
        else if (u.type === 'commando') u._plan = commandoDecide(u, state.units);
        else if (u.type === 'civ') u._plan = civilianDecide(u, state.units);
        else if (u.type === 'marksman') u._plan = marksmanDecide(u, state.units);
        else u._plan = soldierDecide(u, state.units);
    }
}
export function planCleaningUp(aliveUnits: Unit[], winningTeamId: string) {
    const corpses = state.units.filter(u => u.alive && u.type === 'corpse');
    if (corpses.length === 0) return;

    const winningTeamUnits = aliveUnits.filter(u => u.team === winningTeamId);

    for (const u of winningTeamUnits) {
        corpses.sort((a, b) => 
            (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - 
            (Math.abs(b.x - u.x) + Math.abs(b.y - u.y))
        );
        const targetCorpse = corpses[0];

        if (!targetCorpse) {
            u._plan = { move: { x: u.x, y: u.y } };
            continue;
        }

        const isAdjacent = Math.max(Math.abs(u.x - targetCorpse.x), Math.abs(u.y - targetCorpse.y)) <= 1;

        if (isAdjacent) {
            u._plan = { attack: targetCorpse.id };
        } else {
            u._plan = { move: moveToTarget(u, targetCorpse, state.units, false) };
        }
    }
}
export function planPatchingUp(winningTeamUnits: Unit[], winningTeamId: string) {
    const wounded = winningTeamUnits.filter(u => u.hp < u.maxHP);
    wounded.sort((a, b) => (a.hp / a.maxHP) - (b.hp / b.maxHP)); 
    for (const u of winningTeamUnits) {
        if (u.type === 'medic') {
            const target = wounded.length > 0 ? wounded[0] : null;
            if (target) {
                if (Math.max(Math.abs(target.x - u.x), Math.abs(target.y - u.y)) <= 3 && u.healCooldown === 0) {
                    u._plan = { healTargetId: target.id };
                } else {
                    u._plan = { move: moveToTarget(u, target, state.units, false) };
                }
            } else { u._plan = { move: { x: u.x, y: u.y } }; }
        } else if (u.hp < u.maxHP) {
             u._plan = { move: { x: u.x, y: u.y } }; // Stay put and wait
        } else {
            const redeployTarget = state.redeployTargets.get(u.id);
            if (redeployTarget && (u.x !== redeployTarget.x || u.y !== redeployTarget.y)) {
                u._plan = { move: moveToTarget(u, redeployTarget, state.units, false) };
            } else { u._plan = { move: { x: u.x, y: u.y } }; }
        }
    }
}
export function planRedeploying(winningTeamUnits: Unit[], winningTeamId: string) {
    state.setRedeployTurnCounter(state.redeployTurnCounter + 1);
    for (const u of winningTeamUnits) {
        const target = state.redeployTargets.get(u.id);
        if (target && (u.x !== target.x || u.y !== target.y)) {
            u._plan = { move: moveToTarget(u, target, state.units, false) };
        } else {
            u._plan = { move: { x: u.x, y: u.y } };
        }
    }
}