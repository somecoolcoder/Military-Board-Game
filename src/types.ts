/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface Position {
  x: number;
  y: number;
}

export interface Animation {
  type: 'projectile' | 'death' | 'heal' | 'bandage' | 'explosion' | 'damage' | 'grenade_projectile';
  from?: Position;
  to?: Position;
  at?: Position;
  id: string;
}

export interface Zone {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Unit {
  id: string;
  type: string;
  x: number;
  y: number;
  realTeam: string;
  team: string;
  hp: number;
  maxHP: number;
  alive: boolean;
  cooldown: number;
  healCooldown: number;
  grenCooldown: number;
  spyCooldown: number;
  attackCooldown: number;
  moveCooldown: number;
  healUses: number;
  lastBandageTurn: number;
  spyRevealed: boolean | null;
  patience?: number;
  positionHistory: Position[];
  lastOffensiveActionTurn: number;
  _plan?: any; // A plan for the current turn
  _reportedGeneralDeath?: boolean;
  ambushPatience?: number;
}

export interface ScenarioUnitCounts {
    sold?: number;
    snip?: number;
    rif?: number;
    med?: number;
    gren?: number;
    commando?: number;
    civ?: number;
    gen?: number;
    spy?: number;
    mark?: number;
}

export interface ScenarioObstacle {
    type: 'wall' | 'corpse';
    x: number;
    y: number;
}

export interface Scenario {
    literalName: string;
    literalLore: string;
    funnyName: string;
    funnyLore: string;
    size: number;
    A: ScenarioUnitCounts;
    B: ScenarioUnitCounts;
    strategies: {
        A: string;
        B: string;
    };
    obstacles?: ScenarioObstacle[];
}