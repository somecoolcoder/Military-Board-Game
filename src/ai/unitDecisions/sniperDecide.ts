/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as C from '../../constants';
import * as state from '../../state';
import * as utils from '../../utils';
import { kiteAndShootDecide } from '../strategies/kiteAndShootDecide';
import { chooseMoveTowards } from '../utils';
import { zoneForTeam } from '../../game';

export function sniperDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);
    
    // 1. Attack logic: If cooldown is over and there are targets, find the best shot.
    if (enemies.length > 0 && u.cooldown === 0) {
        const targetsInRange = enemies.filter(e => {
            if (Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > C.SNIPER_RANGE) return false;
            // Check for line of sight (no walls/corpses in the way)
            return utils.findObstaclesOnBresenhamLine(u, e, all).length === 0;
        });
        if (targetsInRange.length > 0) {
            targetsInRange.sort((a, b) => (utils.unitAuthorityRank(a) + a.hp / 20) - (utils.unitAuthorityRank(b) + b.hp / 20));
            return { attack: targetsInRange[0].id };
        }
    }

    // 2. Movement logic: Based on team strategy
    const strategy = state.teamStrategy[u.team];

    if (strategy === 'Phalanx') {
        const friends = utils.getFriends(u, all);
        friends.push(u);
        let vip = friends.find(f => f.type === 'general');
        if (!vip) vip = friends.sort((a,b) => utils.unitAuthorityRank(a) - utils.unitAuthorityRank(b))[0];
        if (vip) {
            const distanceToVIP = Math.max(Math.abs(vip.x - u.x), Math.abs(vip.y - u.y));
            if (distanceToVIP > 3) return { move: chooseMoveTowards(u, vip, all, false) };
        }
    } else if (strategy === 'Defensive Hold') {
        const homeZone = zoneForTeam(u.team);
        if (u.x < homeZone.x0 || u.x > homeZone.x1 || u.y < homeZone.y0 || u.y > homeZone.y1) {
            const centerOfZone = { x: Math.round((homeZone.x0 + homeZone.x1)/2), y: Math.round((homeZone.y0+homeZone.y1)/2) };
            return { move: chooseMoveTowards(u, centerOfZone, all, true) };
        }
    }

    // Default behavior for other strategies
    return kiteAndShootDecide(u, all);
}