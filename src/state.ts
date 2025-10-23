/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Unit, Animation } from './types';

export let SIZE = 9;
export let units: Unit[] = [];
export let turn = 0;
// FIX: Changed type from `number | null` to `any` to support environments where `setInterval` returns a `Timeout` object instead of a number.
export let autoInterval: any = null;
export let selectedUnitType = 'mil';
export let activeTeam = 'A';
export let savedLayout: Unit[] | null = null;
export let casualties = { A: 0, B: 0 };
export let lastAttackTurn = 0;
export let spyStackTargets: any = { A: null, B: null };
export let priorityTargetForTeam: { [key: string]: string | null } = { A: null, B: null };
export let ambushTargetForTeam: { [key: string]: string | null } = { A: null, B: null };
export let overwhelmTargetForTeam: { [key: string]: string | null } = { A: null, B: null };
export let teamStrategy: any = { A: 'Balanced', B: 'Aggressive Swarm' };
export let teamPrevStrategy: any = { A: 'Balanced', B: 'Aggressive Swarm' };
export let enableCorpses = false;
export let secureAreaAfterBattle = false;
export let showTideOfBattle = false;
export let funnyScenarios = false;
export let gameState: 'COMBAT' | 'CLEANING_UP' | 'PATCHING_UP' | 'REDEPLOYING' | 'GAME_OVER' = 'COMBAT';
export let redeployTargets = new Map();
export let redeployTurnCounter = 0;
export let effects: Animation[] = [];

// Setters to allow other modules to modify state
export function setSize(s: number) { SIZE = s; }
export function setUnits(u: Unit[]) { units = u; }
export function setTurn(t: number) { turn = t; }
// FIX: Changed type from `number | null` to `any` to support environments where `setInterval` returns a `Timeout` object instead of a number.
export function setAutoInterval(i: any) { autoInterval = i; }
export function setSelectedUnitType(t: string) { selectedUnitType = t; }
export function setActiveTeam(t: string) { activeTeam = t; }
export function setSavedLayout(l: Unit[] | null) { savedLayout = l; }
export function setCasualties(c: { A: number, B: number }) { casualties = c; }
export function setLastAttackTurn(t: number) { lastAttackTurn = t; }
export function setPriorityTargetForTeam(p: { [key: string]: string | null }) { priorityTargetForTeam = p; }
export function setAmbushTargetForTeam(a: { [key: string]: string | null }) { ambushTargetForTeam = a; }
export function setOverwhelmTargetForTeam(o: { [key: string]: string | null }) { overwhelmTargetForTeam = o; }
export function setTeamStrategy(s: any) { teamStrategy = s; }
export function setTeamPrevStrategy(s: any) { teamPrevStrategy = s; }
export function setEnableCorpses(e: boolean) { enableCorpses = e; }
export function setSecureAreaAfterBattle(c: boolean) { secureAreaAfterBattle = c; }
export function setShowTideOfBattle(s: boolean) { showTideOfBattle = s; }
export function setFunnyScenarios(f: boolean) { funnyScenarios = f; }
export function setGameState(g: 'COMBAT' | 'CLEANING_UP' | 'PATCHING_UP' | 'REDEPLOYING' | 'GAME_OVER') { gameState = g; }
export function setRedeployTargets(r: Map<any, any>) { redeployTargets = r; }
export function setRedeployTurnCounter(c: number) { redeployTurnCounter = c; }
export function setEffects(e: Animation[]) { effects = e; }