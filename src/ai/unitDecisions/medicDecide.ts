/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import * as utils from '../../utils';
// FIX: The `chooseMoveTowards` function requires a `preferCover` boolean argument.
import { chooseMoveTowards } from '../utils';
import { balancedDecide } from '../strategies/balancedDecide';
import { zoneForTeam } from '../../game';

export function medicDecide(u: Unit, all: Unit[]) {
    // 1. Primary mission: Healing
    const friendsToHeal = utils.getFriends(u, all).filter(f => f.hp < f.maxHP * 0.95);
    if (u.healCooldown === 0 && friendsToHeal.length > 0) {
        friendsToHeal.sort((a,b) => a.hp - b.hp);
        const target = friendsToHeal[0];
        if (Math.max(Math.abs(target.x-u.x), Math.abs(target.y-u.y)) <= 3) {
            return { healTargetId: target.id };
        }
        // FIX: Added missing `preferCover` argument. Medics should prefer cover when moving to heal.
        return { move: chooseMoveTowards(u, target, all, true) };
    }
    
    // 2. Fallback / Idle Behavior: Based on team strategy
    const friends = utils.getFriends(u, all);
    if (friends.length === 0) {
        return balancedDecide(u, all); // No one to support, act as a soldier
    }
    
    const strategy = state.teamStrategy[u.team];
    if (strategy === 'Phalanx') {
        let vip = friends.find(f => f.type === 'general');
        if (!vip) vip = friends.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b))[0];
        if (vip) {
            const distanceToVIP = Math.max(Math.abs(vip.x - u.x), Math.abs(vip.y - u.y));
            // FIX: Added missing `preferCover` argument. In Phalanx, sticking to the VIP is more important than cover.
            if (distanceToVIP > 2) return { move: chooseMoveTowards(u, vip, all, false) };
        }
    } else if (strategy === 'Defensive Hold') {
        const homeZone = zoneForTeam(u.team);
        if (u.x < homeZone.x0 || u.x > homeZone.x1 || u.y < homeZone.y0 || u.y > homeZone.y1) {
            const centerOfZone = { x: Math.round((homeZone.x0 + homeZone.x1)/2), y: Math.round((homeZone.y0+homeZone.y1)/2) };
            // FIX: Added missing `preferCover` argument. Medics should prefer cover when repositioning.
            return { move: chooseMoveTowards(u, centerOfZone, all, true) };
        }
    }

    // Default: Stay near the closest ally
    friends.sort((a, b) => Math.hypot(a.x-u.x, a.y-u.y) - Math.hypot(b.x-u.x, b.y-u.y));
    const closestFriend = friends[0];
    if (Math.hypot(closestFriend.x-u.x, closestFriend.y-u.y) > 2) {
        // FIX: Added missing `preferCover` argument. Medics should prefer cover.
        return { move: chooseMoveTowards(u, closestFriend, all, true) };
    }

    return { move: { x: u.x, y: u.y } };
}