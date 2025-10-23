/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit, Position } from '../../types';
import * as C from '../../constants';
import * as utils from '../../utils';
import * as state from '../../state';
import { findPath, createGridForPathfinding } from '../../pathfinding';
// FIX: The `chooseMoveTowards` and `chooseMoveAwayFrom` functions require a `preferCover` boolean argument.
import { chooseMoveTowards, chooseMoveAwayFrom } from '../utils';
import { log } from '../../ui';

/**
 * Finds the best position to throw a grenade based on maximizing enemy damage
 * while minimizing friendly fire.
 * @param u The grenadier unit.
 * @param enemies A list of all enemy units.
 * @param allUnits A list of all units on the board.
 * @returns An object with the best position and its calculated score, or null if no good throw is found.
 */
function findBestGrenadeSpot(u: Unit, enemies: Unit[], allUnits: Unit[]): { pos: Position, score: number } | null {
    let bestSpot: Position | null = null;
    let maxScore = 0; // A throw must have a positive score to be considered.
    const myTeam = u.team;

    // To optimize, we only check cells around enemies as potential grenade targets.
    const potentialSpots = new Set<string>();
    enemies.forEach(e => {
        // A grenade can land on an enemy or any of its 8 neighbors.
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const spotX = e.x + dx;
                const spotY = e.y + dy;
                if (utils.inBounds(spotX, spotY)) {
                    potentialSpots.add(utils.key(spotX, spotY));
                }
            }
        }
    });

    potentialSpots.forEach(spotKey => {
        const [xStr, yStr] = spotKey.split(',');
        const x = parseInt(xStr);
        const y = parseInt(yStr);

        let currentScore = 0;
        let friendsHit = 0;
        let enemiesHit = 0;

        // Find all units within the 3x3 blast radius.
        const unitsHit = allUnits.filter(unit => unit.alive && Math.max(Math.abs(unit.x - x), Math.abs(unit.y - y)) <= 1);
        
        if (unitsHit.length === 0) return; // Skip empty spots.

        for (const hit of unitsHit) {
            // The grenadier should not be afraid of hitting their own location if they move away.
            // More importantly, don't penalize for hitting other friends.
            if (hit.id === u.id) continue;

            if (hit.team === myTeam) {
                // Heavy penalty for friendly fire.
                currentScore -= (C.UNIT_VALUE[hit.type] || 1) * 5; 
                friendsHit++;
            } else if (enemies.some(e => e.id === hit.id)) {
                // Reward for hitting enemies based on their value.
                currentScore += (C.UNIT_VALUE[hit.type] || 1);
                enemiesHit++;
            }
        }

        // A throw is invalid if it only hits friendly units.
        if (enemiesHit === 0 && friendsHit > 0) {
            return;
        }

        // Add a bonus for hitting multiple enemies to encourage finding clusters.
        if (enemiesHit > 1) {
            currentScore *= (1 + (enemiesHit * 0.5));
        }

        if (currentScore > maxScore) {
            maxScore = currentScore;
            bestSpot = { x, y };
        }
    });
    
    // Any positive score is a valid throw. This allows attacking single, low-value targets.
    return (bestSpot && maxScore > 0) ? { pos: bestSpot, score: maxScore } : null;
}

/**
 * AI logic for the Grenadier.
 * The Grenadier's sole purpose is to throw grenades. It will never engage in melee combat.
 * If it cannot find a good throw, it will reposition to a safer distance.
 */
export function grenadierDecide(u: Unit, all: Unit[]) {
    const enemies = utils.getEnemies(u, all);

    // If there are no enemies, hold position.
    if (!enemies.length) {
        return { move: { x: u.x, y: u.y } };
    }

    // --- DESPERATE MODE CHECK ---
    const isLowHP = u.hp < u.maxHP * 0.4;
    const isCornered = utils.isCornered(u);
    const adjacentEnemies = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
    
    // Team endangered check (similar to Spy logic)
    const friends = utils.getFriends(u, all);
    friends.push(u); // include self for count
    const initialAllyCount = state.savedLayout?.filter(unit => unit.team === u.team).length || friends.length;
    const isTeamEndangered = initialAllyCount > 0 && (friends.length <= 2 || (friends.length / initialAllyCount < 0.3));

    const desperateCondition = (isLowHP && adjacentEnemies.length > 0) || isCornered || isTeamEndangered;

    if (u.grenCooldown === 0 && desperateCondition) {
        let reason = "making a last stand!";
        if (isTeamEndangered) reason = "its team is endangered!";
        else if (isCornered) reason = "it's cornered!";
        else if (isLowHP && adjacentEnemies.length > 0) reason = "it's low HP and under attack!";
        
        // --- Desperate Throw Calculation ---
        // A desperate grenadier will consider a point-blank blast, but not if it causes catastrophic friendly fire.
        const blastCenter = { x: u.x, y: u.y };
        const unitsHit = all.filter(unit => unit.alive && Math.max(Math.abs(unit.x - blastCenter.x), Math.abs(unit.y - blastCenter.y)) <= 1);
        
        let enemyValueHit = 0;
        let friendlyValueHit = 0;

        for (const hit of unitsHit) {
            if (hit.id === u.id) continue; // Grenadier is immune to its own blast.

            if (hit.team === u.team) {
                friendlyValueHit += (C.UNIT_VALUE[hit.type] || 1);
            } else if (enemies.some(e => e.id === hit.id)) {
                enemyValueHit += (C.UNIT_VALUE[hit.type] || 1);
            }
        }

        // The value of enemies hit MUST outweigh the friendly fire value.
        if (enemyValueHit > friendlyValueHit) {
            log(`Desperate Mode: ${u.id} acts because ${reason} (gain: ${enemyValueHit} vs loss: ${friendlyValueHit})`);
            return { grenadeAt: blastCenter };
        } else {
            log(`Desperate Mode: ${u.id} holds fire on desperate attack. Collateral damage (${friendlyValueHit}) would be too high for the gain (${enemyValueHit}).`);
            // By not returning, we let it fall through to the regular, safer grenade logic.
        }
    }


    // If the grenade is on cooldown, reposition defensively.
    if (u.grenCooldown > 0) {
        const closestThreat = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
        // FIX: Added missing `preferCover` argument. Defensive repositioning should seek cover.
        return { move: chooseMoveAwayFrom(u, closestThreat, all, true) };
    }
    
    // Cooldown is ready. Find the best possible grenade throw.
    const bestThrow = findBestGrenadeSpot(u, enemies, all);

    if (bestThrow) {
        const { pos: bestSpot } = bestThrow;

        // If the best spot is in throwing range, throw it.
        if (Math.max(Math.abs(u.x - bestSpot.x), Math.abs(u.y - bestSpot.y)) <= C.GRENADE_RANGE) {
            return { grenadeAt: bestSpot };
        } else {
            // Otherwise, move towards the spot to get in range for the next turn.
            // FIX: Added missing `preferCover` argument. Grenadiers should prefer cover when advancing.
            const move = chooseMoveTowards(u, bestSpot, all, true);
            // BARGE: If blocked, try to bomb the obstacle.
            if (move.x === u.x && move.y === u.y) {
                const dummyTargetUnit = { ...enemies[0], x: bestSpot.x, y: bestSpot.y };
                const obstaclesOnLine = utils.findObstaclesOnBresenhamLine(u, dummyTargetUnit, all);
                if (obstaclesOnLine.length > 0) {
                    const targetObstacle = obstaclesOnLine[0];
                    if (Math.max(Math.abs(u.x - targetObstacle.x), Math.abs(u.y - targetObstacle.y)) <= C.GRENADE_RANGE) {
                        log(`${u.id} is blocked, bombing obstacle ${targetObstacle.id} to clear a path.`);
                        return { grenadeAt: { x: targetObstacle.x, y: targetObstacle.y } };
                    }
                }
            }
            return { move };
        }
    }

    // BARGE: If no good grenade spot was found, check if it's due to obstacles blocking all enemies.
    const closestEnemy = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
    const grid = createGridForPathfinding(all, u, false);
    const path = findPath({x: u.x, y: u.y}, closestEnemy, grid);
    
    // If there is no path to the closest enemy, they are unreachable.
    if (path.length === 0) {
        const obstaclesOnLine = utils.findObstaclesOnBresenhamLine(u, closestEnemy, all);
        if (obstaclesOnLine.length > 0) {
            const targetObstacle = obstaclesOnLine[0];
            // If the blocking obstacle is in range, bomb it.
            if (Math.max(Math.abs(u.x - targetObstacle.x), Math.abs(u.y - targetObstacle.y)) <= C.GRENADE_RANGE) {
                log(`${u.id} can't find a good throw, bombing obstacle ${targetObstacle.id} to reach enemy.`);
                return { grenadeAt: { x: targetObstacle.x, y: targetObstacle.y } };
            } else {
                // Otherwise, move towards the blocking obstacle.
                // FIX: Added missing `preferCover` argument.
                return { move: chooseMoveTowards(u, targetObstacle, all, true) };
            }
        }
    }

    // If no good grenade spot was found and not blocked by obstacles,
    // reposition defensively. Do NOT fall back to a melee attack.
    const closestThreat = enemies.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
    // FIX: Added missing `preferCover` argument.
    return { move: chooseMoveAwayFrom(u, closestThreat, all, true) };
}