/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as C from '../../constants';
import * as state from '../../state';
import * as utils from '../../utils';
import { chooseMoveAwayFrom, chooseMoveTowards } from '../utils';

export function marksmanDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    // --- 1. ATTACK LOGIC ---
    const targetsInRange = enemies.filter(e => {
        if (Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > C.MARKSMAN_RANGE) return false;
        return utils.findObstaclesOnBresenhamLine(u, e, all).length === 0;
    });

    if (targetsInRange.length > 0) {
        // Prioritize the highest value or lowest health target in range.
        targetsInRange.sort((a, b) => (utils.unitAuthorityRank(a) + a.hp / 20) - (utils.unitAuthorityRank(b) + b.hp / 20));
        return { attack: targetsInRange[0].id };
    }

    // --- 2. MOVEMENT LOGIC (KITING) ---
    const DANGER_DISTANCE = 1; // Only adjacent is considered high danger

    const threats = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
    const closestThreat = threats[0];
    const distanceToClosest = Math.max(Math.abs(closestThreat.x - u.x), Math.abs(closestThreat.y - u.y));

    // If an enemy is adjacent, prioritize moving away to a safe firing position.
    if (distanceToClosest <= DANGER_DISTANCE) {
        return { move: chooseMoveAwayFrom(u, closestThreat, all, true) };
    }

    // If no one is in range to shoot, move towards the best target to get in range.
    enemies.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b));
    const bestTarget = enemies[0];
    return { move: chooseMoveTowards(u, bestTarget, all, true) };
}