/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit, Position } from '../types';
import * as state from '../state';
import * as C from '../constants';
import * as utils from '../utils';
import { log } from '../ui';
import { moveToTarget } from '../pathfinding';

/**
 * Scores a potential move based on its distance to a target.
 * @param pos The position of the potential move.
 * @param target The target position to measure against.
 * @param away If true, score is higher for moves farther away.
 * @returns An object containing the position and its score.
 */
function scoreMove(pos: Position, target: Position, away: boolean): { pos: Position; score: number } {
    const distance = Math.hypot(pos.x - target.x, pos.y - target.y);
    // For 'away' moves, a lower score is better (more negative = farther away).
    // For 'towards' moves, a lower score is better (less distance).
    return { pos, score: away ? -distance : distance };
}

/**
 * Checks if a given position provides cover from a potential attacker's position.
 * @param myPos The position to check for cover.
 * @param enemyPos The position of the anticipated attacker.
 * @param all A list of all units.
 * @returns True if the position is in cover, false otherwise.
 */
export function isPositionInCoverFrom(myPos: Position, enemyPos: Position, all: Unit[]): boolean {
    const adjacentObstacles = utils.neighbors(myPos.x, myPos.y)
        .map(n => all.find(u => u.alive && u.x === n.x && u.y === n.y && ['wall', 'corpse'].includes(u.type)))
        .filter(Boolean) as Unit[];

    if (adjacentObstacles.length === 0) return false;

    const line = utils.getLine(myPos.x, myPos.y, enemyPos.x, enemyPos.y);
    if (line.length <= 2) return false; // Adjacent, no room for cover in between

    // Check if any obstacle is on the line between the two points.
    for (const obs of adjacentObstacles) {
        for (let i = 1; i < line.length - 1; i++) {
            if (line[i].x === obs.x && line[i].y === obs.y) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Chooses a move for a unit from its top candidates, with optional cover-seeking behavior.
 * This function filters out "bad" moves before selecting from up to 6 of the best options.
 * @param u The unit moving.
 * @param target The target position.
 * @param all A list of all units.
 * @param away If true, the unit tries to move away from the target.
 * @param preferCover If true, the unit will prioritize moves that provide cover.
 * @returns The chosen position for the move.
 */
function chooseMove(u: Unit, target: Position, all: Unit[], away: boolean, preferCover: boolean): Position {
    const possibleMoves = utils.neighbors(u.x, u.y)
        .filter(n => !all.some(unit => unit.alive && unit.x === n.x && unit.y === n.y && unit.id !== u.id));
    possibleMoves.push({ x: u.x, y: u.y });

    if (possibleMoves.length === 0) return { x: u.x, y: u.y };
    
    const allScoredMoves = possibleMoves.map(p => scoreMove(p, target, away));
    
    // Determine the score of staying put. This is our baseline for a "good" move.
    const currentPosScore = scoreMove({ x: u.x, y: u.y }, target, away).score;

    // Filter for moves that are at least as good as staying put.
    const goodMoves = allScoredMoves.filter(m => m.score <= currentPosScore);
    
    // We consider "good moves" unless there are none (i.e., we are forced to make a "bad" move).
    let movesToConsider = goodMoves.length > 0 ? goodMoves : allScoredMoves;

    if (preferCover) {
        const coverMoves = movesToConsider.filter(m => isPositionInCoverFrom(m.pos, target, all));
        // If we find any cover moves, we exclusively choose from them.
        if (coverMoves.length > 0) {
            movesToConsider = coverMoves;
        }
    }

    movesToConsider.sort((a, b) => a.score - b.score);

    // Take up to the top N candidates from the filtered/sorted list, based on temperature setting.
    const topCandidates = movesToConsider.slice(0, C.AI_MOVE_TEMPERATURE);

    if (topCandidates.length === 0) return { x: u.x, y: u.y };

    // Randomly select one of the top candidates.
    return topCandidates[utils.randInt(0, topCandidates.length - 1)].pos;
}


export function chooseMoveTowards(u: Unit, target: Position, all: Unit[], preferCover: boolean): Position {
    return chooseMove(u, target, all, false, preferCover);
}

export function chooseMoveAwayFrom(u: Unit, target: Position, all: Unit[], preferCover: boolean): Position {
    return chooseMove(u, target, all, true, preferCover);
}

/**
 * If a unit cannot find a path to its target, this function determines
 * the best course of action, which is usually to attack a blocking obstacle.
 */
export function getBreakthroughPlan(u: Unit, target: Unit, all: Unit[]): any {
    // 1. If we are blocked, first choice is to attack an adjacent obstacle.
    const adjacentObstacles = utils.getAdjacentDestructibles(u, all);
    if (adjacentObstacles.length > 0) {
      // Attack the weakest obstacle to clear a path faster.
      adjacentObstacles.sort((a,b) => a.hp - b.hp);
      log(`${u.id} is blocked, attacking adjacent obstacle ${adjacentObstacles[0].id}`);
      return { attack: adjacentObstacles[0].id };
    }

    // 2. No adjacent obstacles. We need to move towards one.
    // Find the "best" obstacle. Best is the one closest to our original enemy target.
    // This helps the unit break through in the general direction of the enemy.
    const allObstacles = all.filter(x => x.alive && ['corpse', 'wall'].includes(x.type));
    if (allObstacles.length > 0) {
        allObstacles.sort((a, b) => {
            const distA = Math.hypot(a.x - target.x, a.y - target.y);
            const distB = Math.hypot(b.x - target.x, b.y - target.y);
            return distA - distB;
        });
        const obstacleTarget = allObstacles[0];
        log(`${u.id} cannot reach ${target.id}, rerouting to break obstacle ${obstacleTarget.id}`);
        // The new move plan is to get to this obstacle.
        return { move: chooseMoveTowards(u, obstacleTarget, all, false) };
    }

    // 3. No path and no obstacles to break. The unit is truly trapped.
    log(`${u.id} is blocked and sees no obstacles to break. Holding position.`);
    return { move: { x: u.x, y: u.y } };
}

export function isStalemated(u: Unit) {
    if (!u.positionHistory || u.positionHistory.length < 5) return false;
    const noMove = u.positionHistory.every((p: any) => p.x === u.positionHistory[0].x && p.y === u.positionHistory[0].y);
    if (noMove && (!u.lastOffensiveActionTurn || (state.turn - u.lastOffensiveActionTurn >= 5))) {
        log(`Stalemate: ${u.id} has not moved or attacked for 5 turns. Forcing action.`);
        return true;
    }
    return false;
}