/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import { chooseMoveTowards } from '../utils';

export function phalanxDecide(u: Unit, all: Unit[]) {
    const friends = utils.getFriends(u, all);
    friends.push(u); // Include self in formation calcs
    const enemies = utils.getEnemies(u, all);

    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    // 1. Find the VIP (General, then highest authority) to form around.
    let vip = friends.find(f => f.type === 'general');
    if (!vip) {
        vip = friends.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b))[0];
    }
    if (!vip) vip = u; // Should not happen if friends list includes self

    const distanceToVIP = Math.max(Math.abs(vip.x - u.x), Math.abs(vip.y - u.y));
    const FORMATION_DISTANCE = 2;
    
    // 2. If too far from VIP, regroup.
    if (distanceToVIP > FORMATION_DISTANCE) {
        return { move: chooseMoveTowards(u, vip, all, false) }; // preferCover = false
    }

    // 3. In formation. Check for immediate threats.
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    if (adjacentEnemies.length > 0) {
        return { attack: adjacentEnemies.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b) || a.hp - b.hp)[0].id };
    }

    // 4. In formation, no adjacent threats. Advance towards the nearest enemy.
    const closestEnemy = enemies.sort((a,b) => {
        // Sort by distance to the VIP to keep the formation moving coherently
        const distA = Math.hypot(a.x - vip!.x, a.y - vip!.y);
        const distB = Math.hypot(b.x - vip!.x, b.y - vip!.y);
        return distA - distB;
    })[0];
    
    return { move: chooseMoveTowards(u, closestEnemy, all, false) }; // preferCover = false
}