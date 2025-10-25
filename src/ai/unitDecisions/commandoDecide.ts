/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import * as C from '../../constants';
// FIX: The `chooseMoveTowards` function requires a `preferCover` boolean argument.
import { chooseMoveTowards, getBreakthroughPlan } from '../utils';

export function commandoDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    // --- 1. ATTACK: If attack is off cooldown, find the best target(s) ---
    if (u.attackCooldown === 0) {
        const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
        
        if (adjacentEnemies.length > 0) {
            // Smart multi-target selection:
            // Prioritize finishing off low HP targets, then high-value targets.
            adjacentEnemies.sort((a, b) => {
                const aIsLowHP = a.hp < C.COMMANDO_MIN;
                const bIsLowHP = b.hp < C.COMMANDO_MIN;
                if (aIsLowHP !== bIsLowHP) return aIsLowHP ? -1 : 1;
                return utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b) || a.hp - b.hp;
            });
            // The commando attack logic in game.ts attacks all adjacent enemies up to its max target count.
            // We just need to signal the intention to attack by providing one valid target.
            return { attack: adjacentEnemies[0].id };
        }
    }

    // --- 2. REPOSITION: If we can't attack but can move, find a priority target ---
    if (u.moveCooldown === 0) {
        // "Hunter-Killer" logic: find the highest value target on the board.
        enemies.sort((a, b) => {
            // Prioritize enemies adjacent to cover ("Breach" targets).
            const aIsBreachTarget = utils.getAdjacentDestructibles(a, all).length > 0;
            const bIsBreachTarget = utils.getAdjacentDestructibles(b, all).length > 0;
            if (aIsBreachTarget !== bIsBreachTarget) return aIsBreachTarget ? -1 : 1;

            // Then prioritize high-value units (Generals, Snipers, etc.).
            const rankDiff = utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b);
            if (rankDiff !== 0) return rankDiff;

            // Finally, prioritize closer units.
            const distA = Math.hypot(a.x - u.x, a.y - u.y);
            const distB = Math.hypot(b.x - u.x, b.y - u.y);
            return distA - distB;
        });

        const target = enemies[0];
        // FIX: Added missing `preferCover` argument. Commandos are aggressive and should not prioritize cover over closing distance.
        const move = chooseMoveTowards(u, target, all, false);
        const isAdjacent = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= 1;

        // If blocked, try to break through obstacles.
        if (move.x === u.x && move.y === u.y && !isAdjacent) {
            return getBreakthroughPlan(u, target, all);
        }
        return { move };
    }

    // --- 3. All cooldowns are active, hold position ---
    return { move: { x: u.x, y: u.y } };
}
