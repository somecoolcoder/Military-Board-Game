/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import * as utils from '../../utils';
import { chooseMoveTowards } from '../utils';
import { aggressiveSwarmDecide } from './aggressiveSwarmDecide';

export function ambushDecide(u: Unit, all: Unit[]) {
    // 1. If a global ambush target is set, converge on it.
    const targetId = state.ambushTargetForTeam[u.team];
    const target = state.units.find(x => x.id === targetId && x.alive);
    if (target) {
        const isAdjacent = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= 1;
        if(isAdjacent) return { attack: target.id };
        return { move: chooseMoveTowards(u, target, all, true) }; // preferCover = true
    }

    // 2. No global target. Look for local opportunities.
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    const AMBUSH_RANGE = 3;
    const enemiesInRange = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= AMBUSH_RANGE);

    if (enemiesInRange.length > 0) {
        // Spring the trap! Reset patience and attack.
        if (u.ambushPatience !== undefined) u.ambushPatience = 3; 
        
        const adjacentEnemies = enemiesInRange.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
        if (adjacentEnemies.length > 0) {
            // Attack the weakest adjacent enemy
            return { attack: adjacentEnemies.sort((a,b) => a.hp - b.hp)[0].id };
        }
        // Move to engage the closest enemy in range
        const closestEnemy = enemiesInRange.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
        return { move: chooseMoveTowards(u, closestEnemy, all, true) }; // preferCover = true
    }
    
    // 3. No enemies in range. Check patience.
    if (u.ambushPatience !== undefined && u.ambushPatience > 0) {
        u.ambushPatience--;
        // While lurking, try to find a better cover spot nearby.
        const closestEnemy = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
        const move = chooseMoveTowards(u, u, all, true); // move towards self with preferCover to find cover
        if (move.x !== u.x || move.y !== u.y) {
            return { move }; // Reposition to better cover
        }
        return { move: { x: u.x, y: u.y } }; // Lurk...
    }

    // 4. Patience has run out. The ambush failed. Go aggressive.
    if (u.ambushPatience !== undefined) u.ambushPatience = 3; // Reset for next time
    return aggressiveSwarmDecide(u, all);
}
