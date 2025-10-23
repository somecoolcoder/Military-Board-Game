/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import { chooseMoveTowards, chooseMoveAwayFrom } from '../utils';

export function kiteAndShootDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    const DANGER_DISTANCE = 2;
    const KITE_DISTANCE = 4; // Prefer to stay at this distance

    const threats = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
    const closestThreat = threats[0];
    const distanceToClosest = Math.max(Math.abs(closestThreat.x - u.x), Math.abs(closestThreat.y - u.y));

    // 1. Retreat if enemy is too close.
    if (distanceToClosest <= DANGER_DISTANCE) {
        return { move: chooseMoveAwayFrom(u, closestThreat, all, true) }; // preferCover = true
    }
    
    // 2. Attack adjacent enemies if not in danger (fallback).
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    if (adjacentEnemies.length > 0) {
        return { attack: adjacentEnemies.sort((a,b) => a.hp - b.hp)[0].id };
    }

    // 3. If no one is too close, but not in ideal range, reposition.
    if (distanceToClosest > KITE_DISTANCE) {
        return { move: chooseMoveTowards(u, closestThreat, all, true) }; // preferCover = true
    }
    
    // 4. In a good position, not in danger. Hold position and wait for a shot.
    return { move: { x: u.x, y: u.y } };
}