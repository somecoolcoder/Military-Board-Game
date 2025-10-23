/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import { balancedDecide } from '../strategies/balancedDecide';
import { aggressiveSwarmDecide } from '../strategies/aggressiveSwarmDecide';
import { overwhelmDecide } from '../strategies/overwhelmDecide';
import { focusFireDecide } from '../strategies/focusFireDecide';
import { defensiveHoldDecide } from '../strategies/defensiveHoldDecide';
import { kiteAndShootDecide } from '../strategies/kiteAndShootDecide';
import { phalanxDecide } from '../strategies/phalanxDecide';
import { ambushDecide } from '../strategies/ambushDecide';

export function civilianDecide(u: Unit, all: Unit[]) {
    const s = state.teamStrategy[u.team];
    switch (s) {
        case 'Aggressive Swarm': return aggressiveSwarmDecide(u, all);
        case 'Overwhelm': return overwhelmDecide(u, all);
        case 'Focus Fire': return focusFireDecide(u, all);
        case 'Defensive Hold': return defensiveHoldDecide(u, all);
        case 'Kite & Shoot': return kiteAndShootDecide(u, all);
        case 'Phalanx': return phalanxDecide(u, all);
        case 'Ambush': return ambushDecide(u, all);
        case 'Balanced':
        default:
            return balancedDecide(u, all);
    }
}
