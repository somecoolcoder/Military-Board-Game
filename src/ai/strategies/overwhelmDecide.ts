/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import { getBreakthroughPlan, chooseMoveTowards } from '../utils';
import { aggressiveSwarmDecide } from './aggressiveSwarmDecide';

export function overwhelmDecide(u: Unit, all: Unit[]) {
    const targetId = state.overwhelmTargetForTeam[u.team];
    const target = state.units.find(x => x.id === targetId && x.alive);
    if (!target) return aggressiveSwarmDecide(u, all);

    const isAdjacent = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= 1;
    if(isAdjacent) {
        return { attack: target.id };
    }

    const move = chooseMoveTowards(u, target, all, false); // preferCover = false
    if (move.x === u.x && move.y === u.y && !isAdjacent) {
        return getBreakthroughPlan(u, target, all);
    }
    return { move };
}