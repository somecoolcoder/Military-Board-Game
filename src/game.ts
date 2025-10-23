/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit } from './types';
import * as state from './state';
import * as C from './constants';
import * as utils from './utils';
import { log, render, updateStrategySelectsUI, updateStrategyDisplays, stopAuto, getCellEl } from './ui';
import { prepareRedeployment, moveToTarget } from './pathfinding';

export function zoneForTeam(team: string) {
    const zoneTypeEl = document.getElementById('zoneTypeSelect') as HTMLSelectElement;
    const zoneType = zoneTypeEl ? zoneTypeEl.value : 'corners';
    const h = Math.floor(state.SIZE / 2);
    const splitSize = Math.ceil(state.SIZE / 2.5);

    switch (zoneType) {
        case 'vertical':
            return team === 'A' 
                ? { x0: 0, x1: splitSize - 1, y0: 0, y1: state.SIZE - 1 } 
                : { x0: state.SIZE - splitSize, x1: state.SIZE - 1, y0: 0, y1: state.SIZE - 1 };
        case 'horizontal':
            return team === 'A' 
                ? { x0: 0, x1: state.SIZE - 1, y0: 0, y1: splitSize - 1 } 
                : { x0: 0, x1: state.SIZE - 1, y0: state.SIZE - splitSize, y1: state.SIZE - 1 };
        case 'corners':
        default:
            return team === 'A' 
                ? { x0: 0, x1: Math.max(0, h - 1), y0: 0, y1: Math.max(0, h - 1) } 
                : { x0: Math.ceil(state.SIZE / 2), x1: state.SIZE - 1, y0: Math.ceil(state.SIZE / 2), y1: state.SIZE - 1 };
    }
}

function enforceZones() { return (document.getElementById('enforceZones') as HTMLInputElement).checked; }
function highlightActiveZone() { return (document.getElementById('highlightZone') as HTMLInputElement).checked; }

export function addUnitAt(x: number, y: number, t: string, team: string): Unit | null {
  if (!utils.inBounds(x, y)) return null;
  if (state.units.some(u => u.alive && u.x === x && u.y === y)) return null;
  const isObstacle = ['wall', 'corpse'].includes(t);
  let displayTeam = team;
  if (t === 'spy') displayTeam = team === 'A' ? 'B' : 'A';
  if (enforceZones() && !isObstacle) {
    const z = zoneForTeam(displayTeam);
    if (x < z.x0 || x > z.x1 || y < z.y0 || y > z.y1) return null;
  }
  if (t === 'general' && state.units.some(u => u.alive && u.id.startsWith('general') && u.realTeam === team)) return null;
  const idBase = ['mil','sniper','rifle','medic','civ','gren','general','spy','commando','marksman','wall','corpse'].find(base => t.startsWith(base)) || 'unit';
  const id = idBase + '_' + (state.units.length + 1);
  
  let maxHP = C.HP_SOLDIER;
  if (t === 'civ') maxHP = C.HP_CIV;
  else if (t === 'rifle') maxHP = C.HP_RIFLE;
  else if (t === 'sniper') maxHP = C.HP_SNIPER;
  else if (t === 'medic') maxHP = C.HP_MEDIC;
  else if (t === 'gren') maxHP = C.HP_GREN;
  else if (t === 'general') maxHP = C.HP_GENERAL;
  else if (t === 'spy') maxHP = C.HP_SPY;
  else if (t === 'commando') maxHP = C.HP_COMMANDO;
  else if (t === 'marksman') maxHP = C.HP_MARKSMAN;
  else if (t === 'wall') maxHP = C.HP_WALL;
  else if (t === 'corpse') maxHP = 50;
  
  let unitTeam = team;
  if (isObstacle) unitTeam = (t === 'corpse') ? 'CORPSE' : 'OBSTACLE';

  const u: Unit = { id, type: t, x, y, realTeam: unitTeam, team: t === 'spy' ? displayTeam : unitTeam, hp: maxHP, maxHP: maxHP, alive: true, cooldown: 0, healCooldown: 0, grenCooldown: 0, spyCooldown: 0, attackCooldown: 0, moveCooldown: 0, healUses: (t === 'medic') ? C.MEDIC_BANDAGES : (t === 'mil' || t === 'commando') ? C.MAX_HEAL_USES : (t === 'rifle') ? C.RIFLE_BANDAGES : (t === 'general') ? C.GENERAL_BANDAGES : 0, lastBandageTurn: -9999, spyRevealed: (t === 'spy') ? false : null, patience: (t === 'spy') ? 3 : undefined, positionHistory: [], lastOffensiveActionTurn: 0 };
  state.units.push(u);
  return u;
}
export function removeUnitAt(x: number, y: number) { 
    const i = state.units.findIndex(u => u.alive && u.x === x && u.y === y); 
    if (i >= 0) { 
        const r = state.units.splice(i, 1)[0]; 
        render(); log('Removed', r.id, 'at', x, y); 
        return true; 
    } 
    return false; 
}

function resolveActions() {
  const incoming = new Map();
  for (const u of state.units.filter(x => x.alive)) {
    const p = u._plan; if (!p) continue;
    if (p.attack) {
      const tgt = state.units.find(x => x.id === p.attack && x.alive); if (!tgt) continue;

      // GRENADIERS CANNOT MELEE. Their only attack is a grenade. This prevents any fallback AI from making them act like soldiers.
      if (u.type === 'gren') {
        continue;
      }
      
      u.lastOffensiveActionTurn = state.turn;
      state.setLastAttackTurn(state.turn);
      
      // All standard attacks go through this block
      let dmg = 0;
      let logMsg = '';
      
      if (u.type === 'commando' && state.gameState === 'COMBAT') {
        const adjacentEnemies = utils.getEnemies(u, state.units).filter(e => Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
        adjacentEnemies.sort((a,b) => a.hp - b.hp);
        const targetsToAttack = adjacentEnemies.slice(0, C.COMMANDO_MAX_TARGETS);
        for(const t of targetsToAttack) {
            let currentDmg = utils.randInt(C.COMMANDO_MIN, C.COMMANDO_MAX);
            let coverMsg = '';
            if (utils.isTargetInCover(u, t, state.units)) {
                const reducedDmg = Math.round(currentDmg * 0.7);
                coverMsg = `<span class="cover-text"> (Reduced by ${currentDmg - reducedDmg} due to Cover!)</span>`;
                currentDmg = reducedDmg;
            }
            state.effects.push({ type: 'projectile', from: { x: u.x, y: u.y }, to: { x: t.x, y: t.y }, id: `anim_${Date.now()}_${Math.random()}` });
            incoming.set(t.id, (incoming.get(t.id) || 0) + currentDmg);
            log(`${u.id} blasts ${t.id} for ${currentDmg} dmg${coverMsg}`);

            const adjacentCover = utils.getAdjacentDestructibles(t, state.units);
            if (adjacentCover.length > 0) {
                adjacentCover.sort((a,b) => a.hp - b.hp);
                const coverTarget = adjacentCover[0];
                const collateralDmg = Math.round(C.COMMANDO_MIN * 0.25);
                incoming.set(coverTarget.id, (incoming.get(coverTarget.id) || 0) + collateralDmg);
                log(`${u.id}'s attack on ${t.id} deals ${collateralDmg} collateral damage to ${coverTarget.id}!`);
            }
        }
        if (targetsToAttack.length > 0) {
            u.attackCooldown = C.COMMANDO_ATTACK_CD;
        }
        continue;
      }

      if (u.type === 'rifle' && state.gameState === 'COMBAT') {
        const adjacentEnemies = state.units.filter(e => e.alive && e.team !== u.team && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1);
        const targets = adjacentEnemies.slice(0, C.RIFLE_MAX_TARGETS);
        for (const t of targets) {
          let currentDmg = utils.randInt(C.RIFLE_MIN, C.RIFLE_MAX);
          let coverMsg = '';
            if (utils.isTargetInCover(u, t, state.units)) {
                const reducedDmg = Math.round(currentDmg * 0.7);
                coverMsg = `<span class="cover-text"> (Reduced by ${currentDmg - reducedDmg} due to Cover!)</span>`;
                currentDmg = reducedDmg;
            }
          state.effects.push({ type: 'projectile', from: { x: u.x, y: u.y }, to: { x: t.x, y: t.y }, id: `anim_${Date.now()}_${Math.random()}` });
          incoming.set(t.id, (incoming.get(t.id) || 0) + currentDmg);
          log(`${u.id} attacks ${t.id} for ${currentDmg} dmg${coverMsg}`);
        }
        continue;
      }

      if (u.type === 'sniper') dmg = utils.randInt(C.SNIPER_DAMAGE_MIN, C.SNIPER_DAMAGE_MAX);
      else if (u.type === 'marksman') dmg = utils.randInt(C.MARKSMAN_DAMAGE_MIN, C.MARKSMAN_DAMAGE_MAX);
      else dmg = utils.randInt(C.DAMAGE_MIN, C.DAMAGE_MAX);
      
      let coverMsg = '';
      if (utils.isTargetInCover(u, tgt, state.units)) {
        const reducedDmg = Math.round(dmg * 0.7);
        coverMsg = `<span class="cover-text"> (Reduced by ${dmg - reducedDmg} due to Cover!)</span>`;
        dmg = reducedDmg;
      }

      state.effects.push({ type: 'projectile', from: { x: u.x, y: u.y }, to: { x: tgt.x, y: tgt.y }, id: `anim_${Date.now()}_${Math.random()}` });
      incoming.set(tgt.id, (incoming.get(tgt.id) || 0) + dmg);
      log(`${u.id} attacks ${tgt.id} for ${dmg} dmg${coverMsg}`);
      if (u.type === 'sniper') u.cooldown = C.SNIPER_COOLDOWN;
    }
    if (p.grenadeAt) {
      const gx = p.grenadeAt.x, gy = p.grenadeAt.y;
      state.effects.push({ type: 'projectile', from: { x: u.x, y: u.y }, to: { x: gx, y: gy }, id: `anim_${Date.now()}_${Math.random()}` });
      const dmg = utils.randInt(C.GREN_MIN, C.GREN_MAX);
      for (const t of state.units.filter(x => x.alive && Math.max(Math.abs(x.x - gx), Math.abs(x.y - gy)) <= 1)) {
          // Grenadiers are immune to their own blasts.
          if (t.id === u.id) continue;
          incoming.set(t.id, (incoming.get(t.id) || 0) + dmg); 
          state.setLastAttackTurn(state.turn); 
      }
      if (u.grenCooldown !== undefined) u.grenCooldown = C.GREN_COOLDOWN;
      u.lastOffensiveActionTurn = state.turn;
      log(`${u.id} throws grenade at ${gx},${gy} (${dmg})`);
      // Visual effect
      for (let yy = gy - 1; yy <= gy + 1; yy++) {
        for (let xx = gx - 1; xx <= gx + 1; xx++) {
          if (utils.inBounds(xx, yy)) {
            state.effects.push({ type: 'explosion', at: { x: xx, y: yy }, id: `anim_${Date.now()}_${Math.random()}` });
          }
        }
      }
    }
    if (p.backstab) {
        const tgt = state.units.find(x => x.id === p.backstab && x.alive);
        if (tgt) {
            let dmg = utils.randInt(80, 125);
            let coverMsg = '';
            if (utils.isTargetInCover(u, tgt, state.units)) {
                const reducedDmg = Math.round(dmg * 0.7);
                coverMsg = `<span class="cover-text"> (Reduced by ${dmg - reducedDmg} due to Cover!)</span>`;
                dmg = reducedDmg;
            }
            state.effects.push({ type: 'projectile', from: { x: u.x, y: u.y }, to: { x: tgt.x, y: tgt.y }, id: `anim_${Date.now()}_${Math.random()}` });
            incoming.set(tgt.id, (incoming.get(tgt.id) || 0) + dmg);
            u.spyCooldown = C.SPY_COOLDOWN;
            u.lastOffensiveActionTurn = state.turn;
            state.setLastAttackTurn(state.turn);
            log(`${u.id} (spy) backstabs ${tgt.id} for ${dmg}!${coverMsg}`);
            
            const witnesses = state.units.filter(witness => witness.alive && witness.team === tgt.team && witness.id !== tgt.id && Math.max(Math.abs(witness.x - u.x), Math.abs(witness.y - u.y)) <= 3).length;
            const catchProb = Math.min(0.75, 0.25 * witnesses);
            
            if (Math.random() < catchProb) { // Check if caught
                if (!u.spyRevealed) {
                    u.spyRevealed = true;
                    u.team = u.realTeam;
                    state.priorityTargetForTeam[u.team === 'A' ? 'B' : 'A'] = u.id;
                    log(`${u.id} was caught by witnesses and is now revealed!`);
                }
            }
        }
    }
  }
  return incoming;
}

export function step() {
    const oldPositions = new Map<string, {x: number, y: number}>();
    const smoothAnimationsEl = document.getElementById('smoothAnimations') as HTMLInputElement;
    if (smoothAnimationsEl?.checked) {
        for (const u of state.units) {
            if (u.alive) {
                oldPositions.set(u.id, { x: u.x, y: u.y });
            }
        }
    }

    // Clear explosion effects from previous turn
    state.setEffects(state.effects.filter(e => e.type !== 'explosion'));
    state.setTurn(state.turn + 1);
    const alive = state.units.filter(u => u.alive);
    const aliveFighters = alive.filter(u => u.team === 'A' || u.team === 'B');
    const teamsAlive = [...new Set(aliveFighters.map(u => u.team))];
    const winningTeamId = teamsAlive.length === 1 ? teamsAlive[0] : null;

    // --- 1. State Transition from COMBAT ---
    if (state.gameState === 'COMBAT' && teamsAlive.length <= 1) {
        if (winningTeamId) {
            const winningTeamUnits = aliveFighters.filter(u => u.team === winningTeamId);
            const hasMedics = winningTeamUnits.some(u => u.type === 'medic');
            const hasWounded = winningTeamUnits.some(u => u.hp < u.maxHP);
            const corpsesExist = state.units.some(u => u.alive && u.type === 'corpse');

            if (state.secureAreaAfterBattle && corpsesExist) {
                state.setGameState('CLEANING_UP');
                log(`Victory for Team ${winningTeamId}! Securing the area.`);
            } else if (hasMedics && hasWounded) {
                state.setGameState('PATCHING_UP');
                log(`All hostiles eliminated. Team ${winningTeamId}'s medics are patching up remaining units.`);
                if(highlightActiveZone()) prepareRedeployment(winningTeamId); // Prepare targets for healthy units
            } else if (highlightActiveZone()) {
                state.setGameState('REDEPLOYING');
                state.setRedeployTurnCounter(0); // Reset failsafe counter
                prepareRedeployment(winningTeamId);
                log(`Victory for Team ${winningTeamId}! Units are redeploying.`);
            } else {
                state.setGameState('GAME_OVER');
            }
        } else { // 0 teams alive
            state.setGameState('GAME_OVER');
        }
    }

    if (state.gameState === 'GAME_OVER') {
        log('Battle ended on turn', state.turn);
        stopAuto();
        render();
        return;
    }

    // --- 2. Action Planning by State ---
    
    // --- 3. Action Resolution & Movement ---
    const incoming = resolveActions();
    for (const u of state.units.filter(x => x.alive)) {
        const dmg = incoming.get(u.id) || 0;
        if (dmg > 0) {
            u.hp -= dmg;
            log(`${u.id} takes ${dmg} damage -> ${Math.max(0, Math.round(u.hp))} HP`);
            state.effects.push({ type: 'damage', at: { x: u.x, y: u.y }, id: `anim_${Date.now()}_${Math.random()}` });
        }
    }

    for (const u of alive) {
        const p = u._plan;
        if (p && p.move) {
            const tx = p.move.x;
            const ty = p.move.y;
            // Can move if destination is not occupied by another unit, OR if the occupying unit is moving away.
            const occupant = alive.find(other => other.id !== u.id && other.x === tx && other.y === ty);
            const occupantIsMoving = occupant && occupant._plan && occupant._plan.move && (occupant._plan.move.x !== occupant.x || occupant._plan.move.y !== occupant.y);
            
            if (!occupant || occupantIsMoving) {
                 u.x = tx;
                 u.y = ty;
                 if (u.type === 'commando') {
                     u.moveCooldown = C.COMMANDO_MOVE_CD;
                 }
            }
        }
    }

    for (const u of state.units.filter(x => x.alive)) {
        if (u.hp <= 0) {
            u.alive = false;
            state.effects.push({ type: 'death', at: { x: u.x, y: u.y }, id: `anim_${Date.now()}_${Math.random()}` });
            if(u.team === 'A' || u.team === 'B') {
                state.casualties[u.team as 'A' | 'B'] = (state.casualties[u.team as 'A' | 'B'] || 0) + 1;
            }
            log(`${u.id} died.`);
            if (state.enableCorpses && u.type !== 'corpse' && u.type !== 'wall') {
                const corpse: Unit = { id: `corpse_${u.id}`, type: 'corpse', realTeam: 'CORPSE', team: 'CORPSE', x: u.x, y: u.y, hp: 50, maxHP: 50, alive: true, cooldown: 0, healCooldown: 0, grenCooldown: 0, spyCooldown: 0, attackCooldown: 0, moveCooldown: 0, healUses: 0, lastBandageTurn: -9999, spyRevealed: null, positionHistory: [], lastOffensiveActionTurn: 0 };
                state.units.push(corpse);
                log(`Corpse created at (${u.x},${u.y})`);
            }
        }
    }

    const unrevealedSpies = state.units.filter(u => u.alive && u.type === 'spy' && !u.spyRevealed);
    if (unrevealedSpies.length > 0) {
        const allLivingUnits = state.units.filter(u => u.alive && u.type !== 'corpse');
        for (const spy of unrevealedSpies) {
            const hasRealNonSpyTeammates = allLivingUnits.some(u => u.realTeam === spy.realTeam && u.type !== 'spy' );
            const hasInfiltratedTeammates = allLivingUnits.some(u => u.realTeam === spy.team);
            let revealed = false;
            if (!hasRealNonSpyTeammates) {
                log(`Last Stand: ${spy.id} is exposed as all non-spy teammates from Team ${spy.realTeam} are eliminated!`);
                revealed = true;
            } else if (!hasInfiltratedTeammates) {
                log(`Cover Blown: ${spy.id} is exposed as Team ${spy.team} has been eliminated!`);
                revealed = true;
            }
            if (revealed) {
                spy.spyRevealed = true;
                spy.team = spy.realTeam; // Switch to its real team.
                state.priorityTargetForTeam[spy.team === 'A' ? 'B' : 'A'] = spy.id; // Make it a priority target.
            }
        }
    }

    for (const u of state.units.filter(x => x.alive && x.type === 'medic')) {
        const p = u._plan;
        if (p && p.healTargetId && u.healCooldown === 0) {
            const tgt = state.units.find(x => x.id === p.healTargetId && x.alive);
            if (tgt && tgt.hp < tgt.maxHP) {
                let healAmt = utils.randInt(C.MEDIC_HEAL_MIN, C.MEDIC_HEAL_MAX);
                state.effects.push({ type: 'heal', at: { x: tgt.x, y: tgt.y }, id: `anim_${Date.now()}_${Math.random()}` });
                if (tgt.type === 'medic') {
                    healAmt = Math.round(healAmt / 2);
                    log(`${u.id} performs a reduced heal on fellow medic ${tgt.id} for ${healAmt} HP.`);
                } else {
                    log(`${u.id} healed ${tgt.id} for ${healAmt} HP.`);
                }
                tgt.hp = Math.min(tgt.maxHP, tgt.hp + healAmt);
                u.healCooldown = C.MEDIC_HEAL_COOLDOWN;
            }
        }
    }

    for (const u of state.units.filter(x => x.alive && ['medic', 'general', 'mil', 'rifle', 'commando'].includes(x.type))) {
        if (u.type === 'medic') {
            if (u.hp < u.maxHP && u.healUses > 0 && u.lastBandageTurn !== state.turn) {
                u.hp = Math.min(u.maxHP, u.hp + 25);
                u.healUses--;
                u.lastBandageTurn = state.turn;
                state.effects.push({ type: 'bandage', at: { x: u.x, y: u.y }, id: `anim_${Date.now()}_${Math.random()}` });
                log(`${u.id} used a bandage on self (+25). Remaining: ${u.healUses}`);
            }
        } else if (['mil', 'rifle', 'general', 'commando'].includes(u.type) && u.healUses > 0 && u.lastBandageTurn !== state.turn) {
            const friendsAdj = state.units.filter(a => a.team === u.team && a.alive && Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y)) <= 1 && a.hp < a.maxHP && a.id !== u.id);
            if (friendsAdj.length) {
                const tgt = friendsAdj.reduce((A, B) => A.hp < B.hp ? A : B);
                tgt.hp = Math.min(tgt.maxHP, tgt.hp + 25); u.healUses--; u.lastBandageTurn = state.turn;
                state.effects.push({ type: 'bandage', at: { x: tgt.x, y: tgt.y }, id: `anim_${Date.now()}_${Math.random()}` });
                log(`${u.id} bandages ${tgt.id} (+25). Remaining:${u.healUses}`);
            } else if (u.hp < u.maxHP) {
                u.healUses--; u.lastBandageTurn = state.turn; u.hp = Math.min(u.maxHP, u.hp + 25);
                state.effects.push({ type: 'bandage', at: { x: u.x, y: u.y }, id: `anim_${Date.now()}_${Math.random()}` });
                log(`${u.id} bandaged self (+25). Remaining:${u.healUses}`);
            }
        }
    }

    const deadGenerals = state.units.filter(u => !u.alive && u.type === 'general' && !u._reportedGeneralDeath);
    for (const g of deadGenerals) { state.teamStrategy[g.realTeam] = 'Aggressive Swarm'; state.teamPrevStrategy[g.realTeam] = 'Aggressive Swarm'; g._reportedGeneralDeath = true; log(`${g.id} died -> team ${g.realTeam} switches to Aggressive Swarm`); updateStrategySelectsUI(); updateStrategyDisplays(); }
    
    // --- 4. Post-Action State Transitions ---
    if (state.gameState === 'CLEANING_UP') {
        if (!state.units.some(u => u.alive && u.type === 'corpse')) {
            log('Battlefield cleanup complete.');
            const winningTeamUnits = aliveFighters.filter(u => u.team === winningTeamId);
            const hasMedics = winningTeamUnits.some(u => u.type === 'medic');
            const hasWounded = winningTeamUnits.some(u => u.hp < u.maxHP);

            if (hasMedics && hasWounded) {
                state.setGameState('PATCHING_UP');
                log(`Medics are now patching up remaining units.`);
                if (highlightActiveZone()) prepareRedeployment(winningTeamId);
            } else if (highlightActiveZone()) {
                state.setGameState('REDEPLOYING');
                state.setRedeployTurnCounter(0);
                prepareRedeployment(winningTeamId);
                log(`Units are redeploying.`);
            } else {
                state.setGameState('GAME_OVER');
            }
        }
    } else if (state.gameState === 'PATCHING_UP') {
        const winningTeamUnits = aliveFighters.filter(u => u.team === winningTeamId);
        if (!winningTeamUnits.some(u => u.hp < u.maxHP)) {
            log('Patch-up complete.');
            if (highlightActiveZone()) {
                state.setGameState('REDEPLOYING');
                state.setRedeployTurnCounter(0); // Reset failsafe counter
                log(`Units are redeploying to highlighted zones.`);
            } else {
                state.setGameState('GAME_OVER');
            }
        }
    } else if (state.gameState === 'REDEPLOYING') {
        const winningTeamUnits = aliveFighters.filter(u => u.team === winningTeamId);
        const allInPosition = winningTeamUnits.every(u => {
            const target = state.redeployTargets.get(u.id);
            return !target || (u.x === target.x && u.y === target.y);
        });
        if (allInPosition) {
            log('Redeployment complete. Ready for the next wave.');
            state.setGameState('COMBAT');
            stopAuto();
        } else if (state.redeployTurnCounter > state.SIZE * 2) {
            log('Redeployment timed out! Some units did not reach their target. Ready for the next wave.');
            state.setGameState('COMBAT');
            stopAuto();
        }
    }
    
    // --- 5. Cooldowns and History (Common) ---
    for (const u of state.units) {
        if (u.cooldown > 0) u.cooldown--;
        if (u.healCooldown > 0) u.healCooldown--;
        if (u.grenCooldown > 0) u.grenCooldown--;
        if (u.spyCooldown > 0) u.spyCooldown--;
        if (u.attackCooldown > 0) u.attackCooldown--;
        if (u.moveCooldown > 0) u.moveCooldown--;
    }
    
    for (const u of aliveFighters) {
        if (!u.positionHistory) u.positionHistory = [];
        u.positionHistory.push({ x: u.x, y: u.y });
        if (u.positionHistory.length > 5) {
            u.positionHistory.shift();
        }
    }
    
    render(oldPositions);
}

export function applySettings() {
  const s = parseInt((document.getElementById('inpSize') as HTMLInputElement).value) || 9; 
  state.setSize(s);
  
  C.updateConstants({
      HP_SOLDIER: parseInt((document.getElementById('inpHP') as HTMLInputElement).value),
      DAMAGE_MIN: parseInt((document.getElementById('dMin') as HTMLInputElement).value),
      DAMAGE_MAX: parseInt((document.getElementById('dMax') as HTMLInputElement).value),
      RIFLE_MIN: parseInt((document.getElementById('rMin') as HTMLInputElement).value),
      RIFLE_MAX: parseInt((document.getElementById('rMax') as HTMLInputElement).value),
      RIFLE_BANDAGES: parseInt((document.getElementById('rUses') as HTMLInputElement).value),
      MARKSMAN_DAMAGE_MIN: parseInt((document.getElementById('mmMin') as HTMLInputElement).value),
      MARKSMAN_DAMAGE_MAX: parseInt((document.getElementById('mmMax') as HTMLInputElement).value),
      MARKSMAN_RANGE: parseInt((document.getElementById('mmRange') as HTMLInputElement).value),
      SNIPER_DAMAGE_MIN: parseInt((document.getElementById('sMin') as HTMLInputElement).value),
      SNIPER_DAMAGE_MAX: parseInt((document.getElementById('sMax') as HTMLInputElement).value),
      SNIPER_COOLDOWN: parseInt((document.getElementById('sCD') as HTMLInputElement).value),
      SNIPER_RANGE: parseInt((document.getElementById('sRange') as HTMLInputElement).value),
      RIFLE_MAX_TARGETS: parseInt((document.getElementById('rTargets') as HTMLInputElement).value),
      HP_COMMANDO: parseInt((document.getElementById('commandoHP') as HTMLInputElement).value),
      COMMANDO_MIN: parseInt((document.getElementById('cMin') as HTMLInputElement).value),
      COMMANDO_MAX: parseInt((document.getElementById('cMax') as HTMLInputElement).value),
      COMMANDO_MAX_TARGETS: parseInt((document.getElementById('cTargets') as HTMLInputElement).value),
      COMMANDO_ATTACK_CD: parseInt((document.getElementById('cACD') as HTMLInputElement).value),
      COMMANDO_MOVE_CD: parseInt((document.getElementById('cMCD') as HTMLInputElement).value),
      MEDIC_HEAL_MIN: parseInt((document.getElementById('mMin') as HTMLInputElement).value),
      MEDIC_HEAL_MAX: parseInt((document.getElementById('mMax') as HTMLInputElement).value),
      MEDIC_BANDAGES: parseInt((document.getElementById('mUses') as HTMLInputElement).value),
      MEDIC_HEAL_COOLDOWN: parseInt((document.getElementById('mCD') as HTMLInputElement).value),
      MAX_HEAL_USES: parseInt((document.getElementById('hUses') as HTMLInputElement).value),
      GENERAL_BANDAGES: parseInt((document.getElementById('gUses') as HTMLInputElement).value),
      GREN_MIN: parseInt((document.getElementById('gMin') as HTMLInputElement).value),
      GREN_MAX: parseInt((document.getElementById('gMax') as HTMLInputElement).value),
      GREN_COOLDOWN: parseInt((document.getElementById('gCD') as HTMLInputElement).value),
      GRENADE_RANGE: parseInt((document.getElementById('gRange') as HTMLInputElement).value),
  });

  state.setEnableCorpses((document.getElementById('enableCorpses') as HTMLInputElement).checked);
  state.setSecureAreaAfterBattle((document.getElementById('secureArea') as HTMLInputElement).checked);
  state.setShowTideOfBattle((document.getElementById('showTideOfBattle') as HTMLInputElement).checked);
  state.setUnits([]); 
  state.setCasualties({ A: 0, B: 0 }); 
  state.setTurn(0); 
  state.setGameState('COMBAT'); 
  state.redeployTargets.clear();
  state.setEffects([]);
  const animLayer = document.getElementById('animation-layer');
  if (animLayer) animLayer.innerHTML = '';
  render(); 
  log('Settings applied and board reset.');
}

/**
 * Places a team's non-spy units in a strategic formation.
 * @param team The team to place ('A' or 'B').
 * @param unitsToPlace An array of objects with unit type and count.
 */
function placeUnitsInFormation(team: string, unitsToPlace: { type: string; count: number }[]) {
    const spawnZone = zoneForTeam(team);
    const occupiedSpots = new Set(state.units.map(u => utils.key(u.x, u.y)));
    const availableSpots: { x: number; y: number }[] = [];
    for (let y = spawnZone.y0; y <= spawnZone.y1; y++) {
        for (let x = spawnZone.x0; x <= spawnZone.x1; x++) {
            if (!occupiedSpots.has(utils.key(x, y))) {
                availableSpots.push({ x, y });
            }
        }
    }

    const enemyTeam = team === 'A' ? 'B' : 'A';
    const enemyZone = zoneForTeam(enemyTeam);
    const enemyZoneCenter = { x: (enemyZone.x0 + enemyZone.x1) / 2, y: (enemyZone.y0 + enemyZone.y1) / 2 };

    availableSpots.sort((a, b) => {
        const distA = Math.hypot(a.x - enemyZoneCenter.x, a.y - enemyZoneCenter.y);
        const distB = Math.hypot(b.x - enemyZoneCenter.x, b.y - enemyZoneCenter.y);
        return distA - distB;
    });

    const splitPoint = Math.ceil(availableSpots.length / 2);
    const frontlineSpots = availableSpots.slice(0, splitPoint);
    const backlineSpots = availableSpots.slice(splitPoint).reverse();

    const unitsByRole: { [key: string]: string[] } = { frontline: [], support: [] };
    for (const unit of unitsToPlace) {
        for (let i = 0; i < unit.count; i++) {
            const role = C.UNIT_ROLES[unit.type] || 'support';
            if (['frontline', 'frontline_command'].includes(role)) {
                unitsByRole.frontline.push(unit.type);
            } else {
                unitsByRole.support.push(unit.type);
            }
        }
    }
    
    utils.shuffle(unitsByRole.frontline);
    utils.shuffle(unitsByRole.support);

    unitsByRole.frontline.forEach(type => {
        const pos = frontlineSpots.shift() || backlineSpots.pop();
        if (pos) addUnitAt(pos.x, pos.y, type, team);
    });

    unitsByRole.support.forEach(type => {
        const pos = backlineSpots.shift() || frontlineSpots.pop();
        if (pos) addUnitAt(pos.x, pos.y, type, team);
    });
}

function placeSpies(ownerTeam: string, count: number) {
    if (count === 0) return;
    const enemyTeam = ownerTeam === 'A' ? 'B' : 'A';
    const z = zoneForTeam(enemyTeam);
    let attempts = 0, placed = 0;
    while (placed < count && attempts < 200) {
        attempts++;
        const x = utils.randInt(z.x0, z.x1);
        const y = utils.randInt(z.y0, z.y1);
        if (addUnitAt(x, y, 'spy', ownerTeam)) placed++;
    }
}


export function autoFillTeams() {
    const counts = {
      A: { sold: parseInt((document.getElementById('countA') as HTMLInputElement).value) || 0, snip: parseInt((document.getElementById('countAS') as HTMLInputElement).value) || 0, rif: parseInt((document.getElementById('countAR') as HTMLInputElement).value) || 0, med: parseInt((document.getElementById('countAM') as HTMLInputElement).value) || 0, gren: parseInt((document.getElementById('countAG') as HTMLInputElement).value) || 0, comm: parseInt((document.getElementById('countACo') as HTMLInputElement).value) || 0, civ: parseInt((document.getElementById('countAC') as HTMLInputElement).value) || 0, gen: parseInt((document.getElementById('countAGen') as HTMLInputElement).value) || 0, spy: parseInt((document.getElementById('countASpy') as HTMLInputElement).value) || 0, mark: parseInt((document.getElementById('countAMm') as HTMLInputElement).value) || 0 },
      B: { sold: parseInt((document.getElementById('countB') as HTMLInputElement).value) || 0, snip: parseInt((document.getElementById('countBS') as HTMLInputElement).value) || 0, rif: parseInt((document.getElementById('countBR') as HTMLInputElement).value) || 0, med: parseInt((document.getElementById('countBM') as HTMLInputElement).value) || 0, gren: parseInt((document.getElementById('countBG') as HTMLInputElement).value) || 0, comm: parseInt((document.getElementById('countBCo') as HTMLInputElement).value) || 0, civ: parseInt((document.getElementById('countBC') as HTMLInputElement).value) || 0, gen: parseInt((document.getElementById('countBGen') as HTMLInputElement).value) || 0, spy: parseInt((document.getElementById('countBSpy') as HTMLInputElement).value) || 0, mark: parseInt((document.getElementById('countBMm') as HTMLInputElement).value) || 0 }
    };
    
    const unitsToPlaceA = [
        { type: 'general', count: counts.A.gen }, { type: 'commando', count: counts.A.comm },
        { type: 'mil', count: counts.A.sold }, { type: 'rifle', count: counts.A.rif },
        { type: 'gren', count: counts.A.gren }, { type: 'sniper', count: counts.A.snip },
        { type: 'marksman', count: counts.A.mark}, { type: 'medic', count: counts.A.med }, 
        { type: 'civ', count: counts.A.civ },
    ].filter(u => u.count > 0);

    const unitsToPlaceB = [
        { type: 'general', count: counts.B.gen }, { type: 'commando', count: counts.B.comm },
        { type: 'mil', count: counts.B.sold }, { type: 'rifle', count: counts.B.rif },
        { type: 'gren', count: counts.B.gren }, { type: 'sniper', count: counts.B.snip },
        { type: 'marksman', count: counts.B.mark}, { type: 'medic', count: counts.B.med }, 
        { type: 'civ', count: counts.B.civ },
    ].filter(u => u.count > 0);

    // Clear teams but keep obstacles
    state.setUnits(state.units.filter(u => u.team !== 'A' && u.team !== 'B'));
    
    placeUnitsInFormation('A', unitsToPlaceA);
    placeUnitsInFormation('B', unitsToPlaceB);
    
    placeSpies('A', counts.A.spy);
    placeSpies('B', counts.B.spy);

    state.setCasualties({ A: 0, B: 0 }); 
    state.setTurn(0); 
    state.setGameState('COMBAT'); 
    state.redeployTargets.clear(); 
    render(); 
    log('Auto-filled teams with formation logic.');
}