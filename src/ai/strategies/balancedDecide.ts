/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import { getBreakthroughPlan, chooseMoveTowards } from '../utils';

export function balancedDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    if (adjacentEnemies.length > 0) {
        return { attack: adjacentEnemies.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b) || a.hp - b.hp)[0].id };
    }
    const target = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
    
    const move = chooseMoveTowards(u, target, all, true); // preferCover = true
    // If we can't move and we aren't adjacent, we're blocked.
    const isAdjacent = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= 1;
    if (move.x === u.x && move.y === u.y && !isAdjacent) {
        return getBreakthroughPlan(u, target, all);
    }
    return { move };
}