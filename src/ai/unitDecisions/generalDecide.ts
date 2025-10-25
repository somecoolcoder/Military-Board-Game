/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as state from '../../state';
import * as utils from '../../utils';
import * as C from '../../constants';
import { log, updateStrategyDisplays, updateStrategySelectsUI } from '../../ui';
import { balancedDecide } from '../strategies/balancedDecide';
// FIX: The `chooseMoveTowards` function requires a `preferCover` boolean argument.
import { chooseMoveTowards } from '../utils';

function calculateAIStrength(units: Unit[]): number {
    return units.reduce((total, u) => {
        const value = C.UNIT_VALUE[u.type] || 1;
        // Do not count unrevealed spies for strength calculation
        const effectiveHp = (u.type === 'spy' && !u.spyRevealed) ? 0 : u.hp;
        return total + (effectiveHp * value);
    }, 0);
}

export function generalDecide(u: Unit, all: Unit[]): any {
    const friends = all.filter(x => x.alive && x.team === u.team);
    const enemies = utils.getEnemies(u, all);
    
    if (!enemies.length) return { move: { x: u.x, y: u.y } };

    // If the general is the last one standing, it must fight for itself.
    if (friends.length === 1 && friends[0].id === u.id) {
        // Fallback to a direct combat strategy.
        return balancedDecide(u, all); 
    }

    const myTeamId = u.team;

    // --- 1. STRATEGY EVALUATION ---
    // Re-evaluate strategy every 3 turns, or in an emergency (General is hurt or significant losses).
    const significantLosses = friends.length < (state.savedLayout?.filter(unit => unit.realTeam === u.team).length || friends.length + 1) * 0.7;
    const isEmergency = u.hp < u.maxHP * 0.7 || significantLosses;
    
    if (state.turn > 0 && (state.turn % 3 === 0 || isEmergency)) {
        const myStrength = calculateAIStrength(friends);
        const enemyStrength = calculateAIStrength(enemies);
        const strengthRatio = myStrength / (enemyStrength || 1);
        
        let newStrategy = state.teamStrategy[myTeamId];
        const oldStrategy = newStrategy;

        // BASE STRATEGY DECISION
        if (strengthRatio > 2.0) newStrategy = 'Aggressive Swarm';
        else if (strengthRatio > 1.5) newStrategy = 'Overwhelm';
        else if (strengthRatio > 1.1) newStrategy = 'Focus Fire';
        else if (strengthRatio >= 0.9) newStrategy = 'Balanced';
        else if (strengthRatio > 0.6) newStrategy = 'Defensive Hold';
        else if (strengthRatio > 0.4) newStrategy = 'Phalanx';
        else {
            const hasRanged = friends.some(f => ['sniper', 'rifle'].includes(f.type));
            newStrategy = (hasRanged && friends.length > 2) ? 'Kite & Shoot' : 'Ambush';
        }

        // SOPHISTICATED OVERRIDES: Consider counters and composition
        const enemyTeamId = myTeamId === 'A' ? 'B' : 'A';
        const enemyStrategy = state.teamStrategy[enemyTeamId];
        const enemyHasSnipers = enemies.some(e => e.type === 'sniper');
        const friendsHaveSnipers = friends.some(f => f.type === 'sniper');
        const friendsHaveGrenadiers = friends.some(f => f.type === 'gren');

        if (enemyStrategy === 'Phalanx' && friendsHaveGrenadiers) {
            newStrategy = 'Overwhelm';
            log(`General Intelligence: Enemy is in Phalanx, countering with Overwhelm.`);
        } else if (enemyStrategy === 'Kite & Shoot' && strengthRatio > 0.8) {
            newStrategy = 'Aggressive Swarm';
            log(`General Intelligence: Enemy is kiting, countering with Aggressive Swarm.`);
        } else if (friendsHaveSnipers && !enemyHasSnipers && strengthRatio > 0.7 && newStrategy !== 'Aggressive Swarm') {
            newStrategy = 'Kite & Shoot';
            log(`General Intelligence: Leveraging sniper advantage with Kite & Shoot.`);
        }
        
        if (newStrategy === 'Overwhelm') {
            enemies.sort((a,b)=>(utils.getFriends(a,all).length-utils.getFriends(b,all).length||a.hp-b.hp));
            state.overwhelmTargetForTeam[myTeamId] = enemies[0].id;
        } else if (newStrategy === 'Focus Fire') {
            state.priorityTargetForTeam[myTeamId] = enemies.sort((a,b)=>utils.unitAuthorityRank(a)-utils.unitAuthorityRank(b))[0].id;
        }

        if (newStrategy !== oldStrategy) {
            state.teamStrategy[myTeamId] = newStrategy;
            state.teamPrevStrategy[myTeamId] = oldStrategy;
            log(`Turn ${state.turn}: General ${u.id} re-evaluates! Strength ratio: ${strengthRatio.toFixed(2)}. New orders: ${newStrategy}.`);
            updateStrategySelectsUI();
            updateStrategyDisplays();
        }
    }

    // --- 2. PERSONAL ACTION ---
    if (u.hp < u.maxHP * 0.6) {
        const medics = friends.filter(f => f.type === 'medic');
        if (medics.length > 0) {
            medics.sort((a,b)=>(Math.hypot(a.x-u.x,a.y-u.y))-(Math.hypot(b.x-u.x,b.y-u.y)));
            log(`General ${u.id} is wounded and retreating towards medic ${medics[0].id}.`);
            // FIX: Added missing `preferCover` argument. A wounded general should seek cover.
            return { move: chooseMoveTowards(u, medics[0], all, true) };
        }
    }
    
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    if (adjacentEnemies.length > 0) {
        return { attack: adjacentEnemies.sort((a, b) => a.hp - b.hp)[0].id };
    }
    
    if (['Phalanx', 'Defensive Hold'].includes(state.teamStrategy[myTeamId])) {
        return balancedDecide(u, all);
    }

    const avgPos = friends.reduce((acc, f) => ({ x: acc.x + f.x, y: acc.y + f.y }), { x: 0, y: 0 });
    if (friends.length > 0) { avgPos.x /= friends.length; avgPos.y /= friends.length; }
    const enemyAvgPos = enemies.reduce((acc, f) => ({ x: acc.x + f.x, y: acc.y + f.y }), { x: 0, y: 0 });
    if (enemies.length > 0) { enemyAvgPos.x /= enemies.length; enemyAvgPos.y /= enemies.length; }

    const idealX = Math.round(avgPos.x - (enemyAvgPos.x - avgPos.x) * 0.5);
    const idealY = Math.round(avgPos.y - (enemyAvgPos.y - avgPos.y) * 0.5);
    const targetPos = { x: Math.max(0, Math.min(state.SIZE-1, idealX)), y: Math.max(0, Math.min(state.SIZE-1, idealY)) };
    
    if (Math.max(Math.abs(u.x - targetPos.x), Math.abs(u.y - targetPos.y)) <= 1) {
        return { move: { x: u.x, y: u.y } };
    }
    // FIX: Added missing `preferCover` argument. The general should prefer cover when repositioning.
    return { move: chooseMoveTowards(u, targetPos, all, true) };
}
