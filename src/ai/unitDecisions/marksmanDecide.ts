/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as C from '../../constants';
import * as state from '../../state';
import * as utils from '../../utils';
import { chooseMoveAwayFrom, chooseMoveTowards } from '../utils';
import { zoneForTeam } from '../../game';

export function marksmanDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    // --- 1. ATTACK LOGIC: Shoot if a valid target is in range and line of sight. ---
    const targetsInRange = enemies.filter(e => {
        if (Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > C.MARKSMAN_RANGE) return false;
        return utils.findObstaclesOnBresenhamLine(u, e, all).length === 0;
    });

    if (targetsInRange.length > 0) {
        // Prioritize the highest value or lowest health target in range.
        targetsInRange.sort((a, b) => (utils.unitAuthorityRank(a) + a.hp / 20) - (utils.unitAuthorityRank(b) + b.hp / 20));
        return { attack: targetsInRange[0].id };
    }

    // --- 2. SURVIVAL LOGIC: If an enemy is adjacent, kite away. ---
    const DANGER_DISTANCE = 1; // Only adjacent is considered high danger
    const threats = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
    const closestThreat = threats[0];
    const distanceToClosest = Math.max(Math.abs(closestThreat.x - u.x), Math.abs(closestThreat.y - u.y));

    if (distanceToClosest <= DANGER_DISTANCE) {
        return { move: chooseMoveAwayFrom(u, closestThreat, all, true) };
    }

    // --- 3. STRATEGIC REPOSITIONING (Hybrid AI) ---
    // This logic is executed only if the marksman cannot shoot and is not in immediate danger (kiting).
    const strategy = state.teamStrategy[u.team];

    if (strategy === 'Phalanx') {
        const friends = utils.getFriends(u, all);
        friends.push(u); // include self
        let vip = friends.find(f => f.type === 'general');
        if (!vip) {
            vip = friends.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b))[0];
        }
        if (vip) {
            const distanceToVIP = Math.max(Math.abs(vip.x - u.x), Math.abs(vip.y - u.y));
            // Stay within a support bubble of the VIP
            if (distanceToVIP > 3) {
                return { move: chooseMoveTowards(u, vip, all, true) };
            }
        }
        // If in position or no VIP, fall through to default behavior.
    } else if (strategy === 'Defensive Hold') {
        const homeZone = zoneForTeam(u.team);
        // If outside the designated defensive area, move back into it.
        if (u.x < homeZone.x0 || u.x > homeZone.x1 || u.y < homeZone.y0 || u.y > homeZone.y1) {
            const centerOfZone = { x: Math.round((homeZone.x0 + homeZone.x1)/2), y: Math.round((homeZone.y0+homeZone.y1)/2) };
            return { move: chooseMoveTowards(u, centerOfZone, all, true) };
        }
        // If already in the zone, hold position (or fall through to advance on nearby enemies).
    } else if (strategy === 'Kite & Shoot') {
        // Proactively reposition to maintain ideal range.
        const distanceToClosestThreat = Math.max(Math.abs(closestThreat.x - u.x), Math.abs(closestThreat.y - u.y));
        
        // If too far away, close the distance to get into shooting range.
        if (distanceToClosestThreat > C.MARKSMAN_RANGE) {
            return { move: chooseMoveTowards(u, closestThreat, all, true) };
        }
        // Otherwise, hold position, as we are already in a good firing range.
        return { move: { x: u.x, y: u.y } };
    }

    // --- 4. DEFAULT ADVANCE BEHAVIOR ---
    // For 'Balanced', 'Aggressive Swarm', etc., and as a fallback for defensive strategies when in position.
    // This was the original behavior: advance on the highest-value enemy.
    enemies.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b));
    const bestTarget = enemies[0];
    return { move: chooseMoveTowards(u, bestTarget, all, true) };
}
