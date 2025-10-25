/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from './types';
import * as state from './state';
import * as C from './constants';

export function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
export function key(x: number, y: number) { return `${x},${y}`; }
export function inBounds(x: number, y: number) { return x >= 0 && x < state.SIZE && y >= 0 && y < state.SIZE; }
export function neighbors(x: number, y: number) {
  const o: {x: number, y: number}[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!(dx === 0 && dy === 0)) {
    const nx = x + dx, ny = y + dy; if (inBounds(nx, ny)) o.push({ x: nx, y: ny });
  }
  return o;
}
export function getEnemies(u: Unit, all: Unit[]) { return all.filter(x => x.alive && x.team !== u.team && x.type !== 'corpse' && x.team !== 'OBSTACLE' && x.team !== 'CORPSE'); }
export function getFriends(u: Unit, all: Unit[]) { return all.filter(x => x.alive && x.team === u.team && x.id !== u.id); }
export function lowestHPEnemy(u: Unit, all: Unit[]) { const e = getEnemies(u, all); if (!e.length) return null; return e.reduce((a, b) => a.hp < b.hp ? a : b); }
export function getAdjacentDestructibles(u: Unit, all: Unit[]) { return all.filter(x => x.alive && ['corpse', 'wall'].includes(x.type) && Math.max(Math.abs(x.x - u.x), Math.abs(x.y - u.y)) <= 1); }
export function unitAuthorityRank(u: Unit | null) {
  if (!u) return 999;
  if (u.type === 'general') return 1;
  if (u.type === 'commando') return 1.5;
  if (u.type === 'sniper') return 2;
  if (u.type === 'marksman') return 2.5;
  if (u.type === 'spy') { if (u.spyRevealed) return 3; return 999; }
  if (u.type === 'gren') return 4;
  if (u.type === 'rifle') return 5;
  if (u.type === 'medic') return 6;
  if (u.type === 'mil') return 7;
  if (u.type === 'civ') return 8;
  return 9;
}
// Bresenham's line algorithm
export function getLine(x0: number, y0: number, x1: number, y1: number) {
    const points = [];
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
        points.push({x: x0, y: y0});
        if (x0 === x1 && y0 === y1) break;
        let e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
    return points;
}
// Find all obstacles on a direct line to the target.
export function findObstaclesOnBresenhamLine(startUnit: Unit, endUnit: Unit, allUnits: Unit[]) {
    const line = getLine(startUnit.x, startUnit.y, endUnit.x, endUnit.y);
    const obstacles: Unit[] = [];
    // Don't check the start cell.
    for (let i = 1; i < line.length; i++) {
        const pos = line[i];
        const obstacle = allUnits.find(u => u.alive && u.x === pos.x && u.y === pos.y && ['wall', 'corpse'].includes(u.type));
        if (obstacle) {
            obstacles.push(obstacle);
        }
    }
    return obstacles;
}
export function isCornered(u: Unit) { const n = neighbors(u.x, u.y); for (const nb of n) { if (!state.units.some(x => x.alive && x.x === nb.x && x.y === nb.y)) return false; } return true; }

export function isTargetInCover(attacker: Unit, target: Unit, allUnits: Unit[]): boolean {
    // 1. Target must be adjacent to an obstacle.
    const adjacentObstacles = neighbors(target.x, target.y)
        .map(n => allUnits.find(u => u.alive && u.x === n.x && u.y === n.y && ['wall', 'corpse'].includes(u.type)))
        .filter(Boolean) as Unit[];
    
    if (adjacentObstacles.length === 0) return false;

    // 2. An adjacent obstacle must be between the attacker and the target.
    const line = getLine(attacker.x, attacker.y, target.x, target.y);
    if (line.length < 2) return false;

    // Check points on the line, excluding the attacker's own position.
    for (let i = 1; i < line.length; i++) {
        const point = line[i];
        // If the line hits the target, any obstacles beyond it don't provide cover.
        if (point.x === target.x && point.y === target.y) {
            return false;
        }
        // If the line hits one of the adjacent obstacles before hitting the target, they are in cover.
        if (adjacentObstacles.some(obs => obs.x === point.x && obs.y === point.y)) {
            return true;
        }
    }
    
    return false;
}

export function normalizeUnitFields(u: any) {
    if (typeof u.cooldown === 'undefined') u.cooldown = 0;
    if (typeof u.healCooldown === 'undefined') u.healCooldown = 0;
    if (typeof u.healUses === 'undefined') {
      u.healUses = (u.type === 'medic') ? C.MEDIC_BANDAGES : (u.type === 'mil') ? C.SOLDIER_BANDAGES : (u.type === 'commando') ? C.COMMANDO_BANDAGES : (u.type === 'rifle') ? C.RIFLE_BANDAGES : (u.type === 'general') ? C.GENERAL_BANDAGES : 0;
    }
    if (typeof u.grenCooldown === 'undefined') u.grenCooldown = 0;
    if (typeof u.spyCooldown === 'undefined') u.spyCooldown = 0;
    if (typeof u.attackCooldown === 'undefined') u.attackCooldown = 0;
    if (typeof u.moveCooldown === 'undefined') u.moveCooldown = 0;
    if (typeof u.lastBandageTurn === 'undefined') u.lastBandageTurn = -9999;
    if (u.type === 'spy' && typeof u.spyRevealed === 'undefined') u.spyRevealed = false;
    if (u.type === 'spy' && typeof u.patience === 'undefined') u.patience = 3;
    if (typeof u.positionHistory === 'undefined') u.positionHistory = [];
    if (typeof u.lastOffensiveActionTurn === 'undefined') u.lastOffensiveActionTurn = 0;
    if (typeof u.ambushPatience === 'undefined') u.ambushPatience = 3;
}

export function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}