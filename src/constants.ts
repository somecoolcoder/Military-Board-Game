/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// Note: These are exported as `let` because they can be changed by the user in the settings panel.
export let HP_SOLDIER = 100, HP_CIV = 75, HP_RIFLE = 125, HP_SNIPER = 125, HP_MEDIC = 125, HP_GREN = 125, HP_GENERAL = 200, HP_SPY = 75, HP_COMMANDO = 200, HP_WALL = 500, HP_MARKSMAN = 115;
export let DAMAGE_MIN = 20, DAMAGE_MAX = 35;
export let RIFLE_MIN = 25, RIFLE_MAX = 35, RIFLE_MAX_TARGETS = 3, RIFLE_BANDAGES = 3;
export let SNIPER_DAMAGE_MIN = 50, SNIPER_DAMAGE_MAX = 85, SNIPER_COOLDOWN = 2, SNIPER_RANGE = 4;
export let MARKSMAN_DAMAGE_MIN = 30, MARKSMAN_DAMAGE_MAX = 45, MARKSMAN_RANGE = 2;
export let MEDIC_HEAL_MIN = 30, MEDIC_HEAL_MAX = 45, MEDIC_BANDAGES = 3, MEDIC_HEAL_COOLDOWN = 1;
export let SOLDIER_BANDAGES = 3;
export let GREN_MIN = 70, GREN_MAX = 90, GREN_COOLDOWN = 3, GRENADE_RANGE = 2;
export let SPY_COOLDOWN = 3, SPY_BACKSTAB_MIN = 80, SPY_BACKSTAB_MAX = 125;
export let COMMANDO_MIN = 50, COMMANDO_MAX = 85, COMMANDO_MAX_TARGETS = 3, COMMANDO_ATTACK_CD = 1, COMMANDO_MOVE_CD = 1, COMMANDO_BANDAGES = 3, COMMANDO_COLLATERAL_PERCENT = 25;
export let GENERAL_BANDAGES = 10;
export let AI_MOVE_TEMPERATURE = 3;

export const STRATEGIES = [
  { key: 'Balanced', label: 'Balanced', desc: 'Reacts to local threats, balances offense/defense.' },
  { key: 'Aggressive Swarm', label: 'Aggressive Swarm', desc: 'Rush and overwhelm nearest enemies (high offense).' },
  { key: 'Overwhelm', label: 'Overwhelm', desc: 'Identifies and converges on isolated targets.' },
  { key: 'Defensive Hold', label: 'Defensive Hold', desc: 'Forms a defensive line and punishes attackers.' },
  { key: 'Focus Fire', label: 'Focus Fire', desc: 'Entire team concentrates fire on one high-value target.' },
  { key: 'Kite & Shoot', label: 'Kite & Shoot', desc: 'Keeps distance, attacks from range, avoids melee.' },
  { key: 'Phalanx', label: 'Phalanx', desc: 'Forms a tight, mobile fortress to protect VIPs and advance.' },
  { key: 'Ambush', label: 'Ambush', desc: 'Lurks in cover, isolates and swarms lone enemies.' }
];

export const UNIT_ROLES: any = {
    general: 'support', commando: 'frontline', mil: 'frontline', rifle: 'frontline',
    gren: 'frontline', sniper: 'ranged_support', marksman: 'ranged_support', medic: 'support', spy: 'support', civ: 'support'
};

// Value used for AI and Tide of Battle calculations.
export const UNIT_VALUE: { [key: string]: number } = {
    general: 5,
    commando: 4,
    sniper: 3,
    marksman: 2.5,
    gren: 3,
    rifle: 2,
    medic: 2,
    mil: 1.5,
    spy: 1, // Revealed spy
    civ: 0.25,
};

// Average damage output per turn (factoring in cooldowns). Used for Tide of Battle.
export const UNIT_AVG_DAMAGE: { [key: string]: number } = {
    general: 27.5,
    commando: 67.5,
    sniper: 22.5, // (50+85)/2 / 3 turns
    marksman: 37.5,
    gren: 20, // (70+90)/2 / 4 turns
    rifle: 30,
    medic: 0,
    mil: 27.5,
    spy: 25, // backstab / 4 turns
    civ: 10,
};

export const HEAL_LOCK_STRATS = new Set(['Kite & Shoot', 'Phalanx', 'Defensive Hold']);

export function updateConstants(values: any) {
    HP_SOLDIER = values.HP_SOLDIER ?? HP_SOLDIER;
    HP_RIFLE = values.HP_RIFLE ?? HP_RIFLE;
    HP_MARKSMAN = values.HP_MARKSMAN ?? HP_MARKSMAN;
    HP_SNIPER = values.HP_SNIPER ?? HP_SNIPER;
    HP_MEDIC = values.HP_MEDIC ?? HP_MEDIC;
    HP_GREN = values.HP_GREN ?? HP_GREN;
    HP_COMMANDO = values.HP_COMMANDO ?? HP_COMMANDO;
    HP_GENERAL = values.HP_GENERAL ?? HP_GENERAL;
    HP_SPY = values.HP_SPY ?? HP_SPY;
    HP_CIV = values.HP_CIV ?? HP_CIV;
    HP_WALL = values.HP_WALL ?? HP_WALL;

    DAMAGE_MIN = values.DAMAGE_MIN ?? DAMAGE_MIN;
    DAMAGE_MAX = values.DAMAGE_MAX ?? DAMAGE_MAX;
    RIFLE_MIN = values.RIFLE_MIN ?? RIFLE_MIN;
    RIFLE_MAX = values.RIFLE_MAX ?? RIFLE_MAX;
    MARKSMAN_DAMAGE_MIN = values.MARKSMAN_DAMAGE_MIN ?? MARKSMAN_DAMAGE_MIN;
    MARKSMAN_DAMAGE_MAX = values.MARKSMAN_DAMAGE_MAX ?? MARKSMAN_DAMAGE_MAX;
    SNIPER_DAMAGE_MIN = values.SNIPER_DAMAGE_MIN ?? SNIPER_DAMAGE_MIN;
    SNIPER_DAMAGE_MAX = values.SNIPER_DAMAGE_MAX ?? SNIPER_DAMAGE_MAX;
    COMMANDO_MIN = values.COMMANDO_MIN ?? COMMANDO_MIN;
    COMMANDO_MAX = values.COMMANDO_MAX ?? COMMANDO_MAX;
    GREN_MIN = values.GREN_MIN ?? GREN_MIN;
    GREN_MAX = values.GREN_MAX ?? GREN_MAX;
    SPY_BACKSTAB_MIN = values.SPY_BACKSTAB_MIN ?? SPY_BACKSTAB_MIN;
    SPY_BACKSTAB_MAX = values.SPY_BACKSTAB_MAX ?? SPY_BACKSTAB_MAX;
    
    SOLDIER_BANDAGES = values.SOLDIER_BANDAGES ?? SOLDIER_BANDAGES;
    RIFLE_BANDAGES = values.RIFLE_BANDAGES ?? RIFLE_BANDAGES;
    RIFLE_MAX_TARGETS = values.RIFLE_MAX_TARGETS ?? RIFLE_MAX_TARGETS;
    MARKSMAN_RANGE = values.MARKSMAN_RANGE ?? MARKSMAN_RANGE;
    SNIPER_RANGE = values.SNIPER_RANGE ?? SNIPER_RANGE;
    SNIPER_COOLDOWN = values.SNIPER_COOLDOWN ?? SNIPER_COOLDOWN;
    COMMANDO_BANDAGES = values.COMMANDO_BANDAGES ?? COMMANDO_BANDAGES;
    COMMANDO_MAX_TARGETS = values.COMMANDO_MAX_TARGETS ?? COMMANDO_MAX_TARGETS;
    COMMANDO_ATTACK_CD = values.COMMANDO_ATTACK_CD ?? COMMANDO_ATTACK_CD;
    COMMANDO_MOVE_CD = values.COMMANDO_MOVE_CD ?? COMMANDO_MOVE_CD;
    COMMANDO_COLLATERAL_PERCENT = values.COMMANDO_COLLATERAL_PERCENT ?? COMMANDO_COLLATERAL_PERCENT;
    MEDIC_HEAL_MIN = values.MEDIC_HEAL_MIN ?? MEDIC_HEAL_MIN;
    MEDIC_HEAL_MAX = values.MEDIC_HEAL_MAX ?? MEDIC_HEAL_MAX;
    MEDIC_BANDAGES = values.MEDIC_BANDAGES ?? MEDIC_BANDAGES;
    MEDIC_HEAL_COOLDOWN = values.MEDIC_HEAL_COOLDOWN ?? MEDIC_HEAL_COOLDOWN;
    GENERAL_BANDAGES = values.GENERAL_BANDAGES ?? GENERAL_BANDAGES;
    GRENADE_RANGE = values.GRENADE_RANGE ?? GRENADE_RANGE;
    GREN_COOLDOWN = values.GREN_COOLDOWN ?? GREN_COOLDOWN;
    SPY_COOLDOWN = values.SPY_COOLDOWN ?? SPY_COOLDOWN;
    AI_MOVE_TEMPERATURE = values.AI_MOVE_TEMPERATURE ?? AI_MOVE_TEMPERATURE;
}