/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import { chooseMoveTowards } from '../utils';
import { zoneForTeam } from '../../game';

export function defensiveHoldDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    const homeZone = zoneForTeam(u.team);
    const threatsInZone = enemies.filter(e => e.x >= homeZone.x0 && e.x <= homeZone.x1 && e.y >= homeZone.y0 && e.y <= homeZone.y1);
    
    // 1. Prioritize enemies inside the defensive zone.
    if (threatsInZone.length > 0) {
        const adjacentThreats = threatsInZone.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
        if (adjacentThreats.length > 0) {
            // Attack the highest priority adjacent threat in the zone.
            return { attack: adjacentThreats.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b) || a.hp - b.hp)[0].id };
        }
        // Move to engage the closest threat inside the zone.
        const closestThreat = threatsInZone.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
        return { move: chooseMoveTowards(u, closestThreat, all, true) }; // preferCover = true
    }

    // 2. No enemies in zone. Check for adjacent enemies outside the zone to punish.
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    if (adjacentEnemies.length > 0) {
        return { attack: adjacentEnemies.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b) || a.hp - b.hp)[0].id };
    }

    // 3. No immediate threats. Reposition to defensive zone if not already there.
    const isInsideZone = u.x >= homeZone.x0 && u.x <= homeZone.x1 && u.y >= homeZone.y0 && u.y <= homeZone.y1;
    if (!isInsideZone) {
        // Find the closest empty point in the home zone.
        let closestPoint = { x: homeZone.x0, y: homeZone.y0 };
        let min_dist = Infinity;
        for (let y = homeZone.y0; y <= homeZone.y1; y++) {
            for (let x = homeZone.x0; x <= homeZone.x1; x++) {
                if (!all.some(unit => unit.alive && unit.x === x && unit.y === y)) {
                    const dist = Math.abs(x - u.x) + Math.abs(y - u.y);
                    if (dist < min_dist) {
                        min_dist = dist;
                        closestPoint = { x, y };
                    }
                }
            }
        }
        return { move: chooseMoveTowards(u, closestPoint, all, true) }; // preferCover = true
    }
    
    // 4. In zone, no threats. Hold position.
    return { move: { x: u.x, y: u.y } };
}