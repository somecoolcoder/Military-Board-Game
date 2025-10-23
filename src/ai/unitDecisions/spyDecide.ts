/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import * as utils from '../../utils';
// FIX: The `chooseMoveTowards` function requires a `preferCover` boolean argument.
import { chooseMoveTowards } from '../utils';
import { aggressiveSwarmDecide } from '../strategies/aggressiveSwarmDecide';

export function spyDecide(u: Unit, all: Unit[]): any {
    if (u.spyRevealed) {
        // Once revealed, the spy is vulnerable and should fight like a basic soldier.
        return aggressiveSwarmDecide(u, all);
    }

    // --- AI logic for an UNREVEALED spy ---

    // My real enemies are my targets.
    const targets = all.filter(e => e.alive && e.team !== u.realTeam && e.type !== 'corpse' && e.team !== 'OBSTACLE' && e.team !== 'CORPSE');
    // My real allies.
    const allies = all.filter(f => f.alive && f.realTeam === u.realTeam && f.id !== u.id);

    if (targets.length === 0) {
        return { move: { x: u.x, y: u.y } };
    }

    // --- High-Priority Assassination ---
    // If adjacent to the single most powerful enemy on the board, backstab immediately regardless of patience.
    const allTargetsByRank = [...targets].sort((a, b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b));
    const mostPowerfulEnemy = allTargetsByRank[0];
    if (mostPowerfulEnemy && Math.max(Math.abs(mostPowerfulEnemy.x - u.x), Math.abs(mostPowerfulEnemy.y - u.y)) <= 1) {
        return { backstab: mostPowerfulEnemy.id };
    }

    // 1. URGENCY CHECK: Is my real team about to be wiped out?
    // If we have a saved layout, use it for an accurate initial count. Otherwise, estimate.
    const initialAllyCount = state.savedLayout?.filter(unit => unit.realTeam === u.realTeam && unit.type !== 'spy').length || (allies.length > 0 ? allies.length + 1 : 0);
    const currentAllyCount = allies.filter(a => a.type !== 'spy').length;

    // Trigger desperation mode if team is below 30% strength or only 2 non-spy allies remain.
    const isDesperate = initialAllyCount > 0 && (currentAllyCount <= 2 || (currentAllyCount / initialAllyCount < 0.3));

    if (isDesperate) {
        // DESPERATION MODE: Time to act, now or never. Attack the best target I can get to.
        // Sort targets by distance, then by value.
        targets.sort((a, b) => {
            const distA = Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y));
            const distB = Math.max(Math.abs(b.x - u.x), Math.abs(b.y - u.y));
            if (distA !== distB) return distA - distB;
            return utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b);
        });
        const bestTarget = targets[0];
        // If the best target is adjacent, backstab it.
        if (Math.max(Math.abs(bestTarget.x - u.x), Math.abs(bestTarget.y - u.y)) <= 1) {
            return { backstab: bestTarget.id };
        }
        // Otherwise, move towards it.
        // FIX: Added missing `preferCover` argument. A spy should always prefer cover.
        return { move: chooseMoveTowards(u, bestTarget, all, true) };
    }
    
    // 2. OPPORTUNITY & PATIENCE CHECK
    if (u.patience === undefined) u.patience = 3; // Default patience
    if (u.patience > 0) {
        u.patience--;
    }

    const adjacentTargets = targets.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    
    if (adjacentTargets.length > 0) {
        adjacentTargets.sort((a, b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b));
        const bestAdjacentTarget = adjacentTargets[0];
        
        // Check for low-diversity scenario: are there ANY high-value targets on the map?
        const bestOverallTargetRank = allTargetsByRank.length > 0 ? utils.unitAuthorityRank(allTargetsByRank[0]) : 99;
        const isLowDiversity = bestOverallTargetRank > 5; // Best available target is a medic or soldier

        // Attack if: target is high value OR patience ran out OR it's a low diversity battlefield
        if (utils.unitAuthorityRank(bestAdjacentTarget) <= 4 || u.patience === 0 || isLowDiversity) {
            return { backstab: bestAdjacentTarget.id };
        }
    }

    // 3. REPOSITIONING: No attack was made, so move into a better position.
    if (allTargetsByRank.length > 0) {
        const idealTarget = allTargetsByRank[0];
        // Move towards the highest-value enemy to prepare for a strike.
        // FIX: Added missing `preferCover` argument. Spies should seek cover when repositioning.
        return { move: chooseMoveTowards(u, idealTarget, all, true) };
    }

    // Default action: if no targets or plans, stay put.
    return { move: { x: u.x, y: u.y } };
}