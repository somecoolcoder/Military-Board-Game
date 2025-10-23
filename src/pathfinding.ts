/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit, Position } from './types';
import * as state from './state';
import { inBounds, key, neighbors } from './utils';
import { log } from './ui';
import { UNIT_ROLES } from './constants';
import { zoneForTeam } from './game';

/* ======================================================
    A* Pathfinding Implementation
    ====================================================== */
// FIX: Export `findPath` function so it can be imported by other modules.
export function findPath(start: Position, end: Position, grid: number[][]) {
    const cols = state.SIZE;
    const rows = state.SIZE;
    let openSet: any[] = [];
    const closedSet = new Set();
    const nodes = new Map();

    function heuristic(a: Position, b: Position) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    function getNode(x: number, y: number) {
        const nodeKey = key(x, y);
        if (!nodes.has(nodeKey)) {
            nodes.set(nodeKey, { x, y, g: Infinity, h: Infinity, f: Infinity, previous: null });
        }
        return nodes.get(nodeKey);
    }
    
    const startNode = getNode(start.x, start.y);
    const endNode = getNode(end.x, end.y);
    
    startNode.g = 0;
    startNode.h = heuristic(startNode, endNode);
    startNode.f = startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();

        if (current.x === endNode.x && current.y === endNode.y) {
            const path = [];
            let temp = current;
            while (temp) {
                path.push({ x: temp.x, y: temp.y });
                temp = temp.previous;
            }
            return path.reverse();
        }

        closedSet.add(key(current.x, current.y));

        const currentNeighbors = neighbors(current.x, current.y);
        for (const neighborPos of currentNeighbors) {
            if (closedSet.has(key(neighborPos.x, neighborPos.y)) || grid[neighborPos.y][neighborPos.x] === 1) {
                continue;
            }

            const neighborNode = getNode(neighborPos.x, neighborPos.y);
            const tentativeG = current.g + 1; // All steps cost 1

            if (tentativeG < neighborNode.g) {
                neighborNode.previous = current;
                neighborNode.g = tentativeG;
                neighborNode.h = heuristic(neighborNode, endNode);
                neighborNode.f = neighborNode.g + neighborNode.h;

                if (!openSet.some(n => n.x === neighborNode.x && n.y === neighborNode.y)) {
                    openSet.push(neighborNode);
                }
            }
        }
    }
    return []; // No path found
}
export function createGridForPathfinding(allUnits: Unit[], selfUnit: Unit, ignoreUnits = false) {
    const grid = Array(state.SIZE).fill(0).map(() => Array(state.SIZE).fill(0));
    for (const u of allUnits) {
        if (u.alive && u.id !== selfUnit.id) {
            // In normal mode (!ignoreUnits), all other units are obstacles.
            // In ignoreUnits mode, only corpses are obstacles.
            if (!ignoreUnits || u.type === 'corpse' || u.type === 'wall') {
                grid[u.y][u.x] = 1; // 1 represents an obstacle
            }
        }
    }
    return grid;
}
export function moveToTarget(u: Unit, targetPos: Position, all: Unit[], ignoreUnits = false) {
    const grid = createGridForPathfinding(all, u, ignoreUnits);
    const start = { x: u.x, y: u.y };
    let end = { x: targetPos.x, y: targetPos.y };

    const isTargetOccupied = all.some(unit => unit.alive && unit.id !== u.id && unit.x === end.x && unit.y === end.y);

    if (isTargetOccupied) {
        const availableNeighbors = neighbors(end.x, end.y).filter(n => {
            // An adjacent spot is available if it's not occupied by a relevant obstacle.
            // If ignoring units, only walls/corpses block.
            // If not ignoring units, ANY other living unit blocks.
            return !all.some(unit => 
                unit.alive && 
                unit.id !== u.id &&
                unit.x === n.x && 
                unit.y === n.y &&
                (!ignoreUnits || ['wall', 'corpse'].includes(unit.type))
            );
        });
        
        if (availableNeighbors.length > 0) {
            // Sort by distance to find the closest adjacent spot to move towards.
            availableNeighbors.sort((a,b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)));
            end = availableNeighbors[0];
        } else {
            return { x: u.x, y: u.y }; // Target is surrounded, stay put
        }
    }
    
    const path = findPath(start, end, grid);
    if (path && path.length > 1) {
        return { x: path[1].x, y: path[1].y }; // path[0] is the start position
    }
    return { x: u.x, y: u.y }; // Stay put if no path or already there
}

export function prepareRedeployment(winningTeamId: string) {
    state.redeployTargets.clear();
    const winningUnits = state.units.filter(u => u.alive && u.team === winningTeamId && u.type !== 'corpse');
    if (winningUnits.length === 0) return;

    // 1. Get zone and available spots.
    const z = zoneForTeam(winningTeamId);
    const allCurrentPositions = new Set(state.units.filter(u => u.alive).map(u => key(u.x, u.y)));
    const availableSpots: Position[] = [];
    for (let y = z.y0; y <= z.y1; y++) {
        for (let x = z.x0; x <= z.x1; x++) {
            if (!allCurrentPositions.has(key(x, y))) {
                availableSpots.push({ x, y });
            }
        }
    }

    // 2. Classify units by role.
    const unitsByRole: any = { frontline: [], support: [], ranged_support: [], frontline_command: [] };
    winningUnits.forEach(u => {
        const role = UNIT_ROLES[u.type] || 'support';
        if (unitsByRole[role]) unitsByRole[role].push(u);
    });

    // Sort units within roles for consistent assignment.
    for (const role in unitsByRole) {
        unitsByRole[role].sort((a: any, b: any) => a.id.localeCompare(b.id));
    }
    
    // 3. Determine formation anchor based on the enemy's position.
    const enemyTeamId = winningTeamId === 'A' ? 'B' : 'A';
    const enemyZone = zoneForTeam(enemyTeamId);
    const enemyZoneCenter = { x: (enemyZone.x0 + enemyZone.x1) / 2, y: (enemyZone.y0 + enemyZone.y1) / 2 };

    // Sort available spots: closer to enemy = front, farther = back.
    availableSpots.sort((a, b) => {
        const distA = Math.hypot(a.x - enemyZoneCenter.x, a.y - enemyZoneCenter.y);
        const distB = Math.hypot(b.x - enemyZoneCenter.x, b.y - enemyZoneCenter.y);
        return distA - distB; // Sorts from closest to farthest
    });
    
    const splitPoint = Math.ceil(availableSpots.length / 2);
    const frontlineSpots = availableSpots.slice(0, splitPoint);
    const backlineSpots = availableSpots.slice(splitPoint).reverse();

    const assignTargets = (unitsToPlace: Unit[], spots: Position[]) => {
        unitsToPlace.forEach(u => {
            if (spots.length > 0) {
                let bestSpot = spots.shift()!; // Take the next available spot.
                
                // Failsafe: Check if the spot is reachable.
                const grid = createGridForPathfinding(state.units, u, false);
                const path = findPath({x: u.x, y: u.y}, bestSpot, grid);
                if (path.length === 0) {
                    // Unreachable! Find the closest reachable spot from all available spots.
                    log(`Warning: Target ${bestSpot.x},${bestSpot.y} for ${u.id} is unreachable. Finding alternative.`);
                    const allReachableSpots = [...frontlineSpots, ...backlineSpots].filter(p => findPath({x:u.x, y:u.y}, p, grid).length > 0);
                    if(allReachableSpots.length > 0) {
                        allReachableSpots.sort((a,b) => (Math.abs(a.x-u.x)+Math.abs(a.y-u.y))-(Math.abs(b.x-u.x)+Math.abs(b.y-u.y)));
                        bestSpot = allReachableSpots[0];
                    } else {
                        log(`FATAL: ${u.id} is trapped and cannot reach any formation spot.`);
                        bestSpot = {x: u.x, y: u.y}; // Stay put
                    }
                }
                state.redeployTargets.set(u.id, bestSpot);
            } else {
                state.redeployTargets.set(u.id, { x: u.x, y: u.y }); // No spots left, stay put.
            }
        });
    };
    
    assignTargets([...unitsByRole.frontline_command, ...unitsByRole.frontline], frontlineSpots);
    assignTargets([...unitsByRole.support, ...unitsByRole.ranged_support], backlineSpots);

    // Ensure every unit has a target, even if it's just their current spot.
    winningUnits.forEach(u => {
        if (!state.redeployTargets.has(u.id)) {
            state.redeployTargets.set(u.id, { x: u.x, y: u.y });
        }
    });
    log(`Generated ${state.redeployTargets.size} redeployment targets for Team ${winningTeamId}.`);
}