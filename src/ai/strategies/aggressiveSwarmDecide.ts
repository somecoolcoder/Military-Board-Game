/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from '../../types';
import * as utils from '../../utils';
import { getBreakthroughPlan, chooseMoveTowards } from '../utils';

export function aggressiveSwarmDecide(u: Unit, all: Unit[]) {
  const enemies = utils.getEnemies(u, all);
  if (!enemies.length) {
    const obstacles = utils.getAdjacentDestructibles(u, all);
    if (obstacles.length) return { attack: obstacles[0].id };
    return { move: { x: u.x, y: u.y } };
  }
  const adjacent = enemies.filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
  if (adjacent.length) {
    const weakest = adjacent.reduce((A, B) => A.hp < B.hp ? A : B);
    return { attack: weakest.id };
  }
  
  enemies.sort((a, b) => {
    const da = Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y));
    const db = Math.max(Math.abs(b.x - u.x), Math.abs(b.y - u.y));
    return da - db;
  });
  const target = enemies[0];
  
  const move = chooseMoveTowards(u, target, all, false); // preferCover = false
  // If we can't move and we aren't adjacent, we're blocked.
  const isAdjacent = Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= 1;
  if (move.x === u.x && move.y === u.y && !isAdjacent) {
    return getBreakthroughPlan(u, target, all);
  }
  return { move };
}
