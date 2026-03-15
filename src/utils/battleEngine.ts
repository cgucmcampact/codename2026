
import type { BattleParticipant } from '../types';

export interface BattleLog {
    turn: number;
    actorId: string;
    targetId: string;
    action: 'attack' | 'skill' | 'defend' | 'heal';
    damage: number;
    isCrit: boolean;
    isMiss: boolean;
    isCombo: boolean;
    currentHp: number; // Target's HP after hit
    maxHp: number;
    message: string;
}

export interface SimulationResult {
    winnerId: string;
    logs: BattleLog[];
    finalHp: Record<string, number>;
}

// PRNG for Deterministic Results
class PRNG {
    private state: number;
    private readonly m = 2147483648;
    private readonly a = 1103515245;
    private readonly c = 12345;

    constructor(seed: number) {
        this.state = seed;
    }

    // 0.0 to 1.0 (exclusive of 1.0)
    next(): number {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state / this.m;
    }

    static hash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
}

export const simulateBattle = (
    challenger: BattleParticipant,
    defender: BattleParticipant,
    battleId: string
): SimulationResult => {
    const seed = PRNG.hash(battleId);
    const rng = new PRNG(seed);
    const logs: BattleLog[] = [];

    // Pools for Random Narratives
    const pick = (arr: string[]) => arr[Math.floor(rng.next() * arr.length)];

    const NARRATIVES = {
        action: (name: string) => pick([
            `${name} 猛力衝撞！`,
            `${name} 試圖戳擊！`,
            `${name} 發起重重地橫掃！`,
            `${name} 抓準破綻進行突擊！`
        ]),
        hitResult: (targetName: string, dmg: number) => pick([
            `對 ${targetName} 造成了 ${dmg} 點傷害。`,
            `精準命中，造成了 ${dmg} 點傷害。`,
            `重創對手，造成了 ${dmg} 點傷害。`
        ]),
        dodgeSuccess: (name: string) => pick([
            `${name} 試著往後扭，優雅地躲開了。`,
            `${name} 一個側身，讓攻擊落空了。`,
            `${name} 靈活地跳開，毫髮無傷。`,
            `${name} 閃得飛快，對方只打中了空氣。`
        ]),
        dodgeFail: (name: string) => pick([
            `${name} 想往後扭但失敗了，結實地挨了一拳！`,
            `${name} 沒躲開，硬生生吃了這一下。`,
            `${name} 反應慢了一拍，被正中紅心。`
        ]),
        block: (name: string, dmg: number) => pick([
            `${name} 硬擋了一下！傷害減輕，受到 ${dmg} 點傷害。`,
            `${name} 挺起胸膛格擋！只受到 ${dmg} 點傷害。`,
            `${name} 勉強撐住防禦，受到 ${dmg} 點傷害。`
        ])
    };

    // Initial State - Fixed 200 HP
    let state = {
        [challenger.teamId]: {
            ...challenger,
            currentHp: 200,
            maxHp: 200
        },
        [defender.teamId]: {
            ...defender,
            currentHp: 200,
            maxHp: 200
        }
    };

    let actors = [state[challenger.teamId], state[defender.teamId]];

    // Sort by Speed (Descending) - Higher SPD goes first
    actors.sort((a, b) => b.stats.speed - a.stats.speed);

    // Speed Tie: Deterministic Shuffle
    if (actors[0].stats.speed === actors[1].stats.speed) {
        if (rng.next() > 0.5) {
            actors.reverse();
        }
    }

    let turn = 1;
    const MAX_TURNS = 100;

    while (state[challenger.teamId].currentHp > 0 && state[defender.teamId].currentHp > 0 && turn <= MAX_TURNS) {
        const attacker = actors[(turn - 1) % 2];
        const target = actors[(turn - 1) % 2 === 0 ? 1 : 0];

        // Attack Logic Function
        const performAttack = (isCombo = false) => {
            const { stats: aStats } = attacker;
            const { stats: tStats } = target;

            // 1. Dodge Check
            // Final Dodge = 10% + ((MySPD - EnemySPD) * 1%)
            // where "MySPD" is the defender/target
            let dodgeChance = 0.1 + (tStats.speed - aStats.speed) * 0.01;
            dodgeChance = Math.max(0.05, Math.min(0.3, dodgeChance));

            const isDodgeSuccess = rng.next() < dodgeChance;

            if (isDodgeSuccess) {
                logs.push({
                    turn,
                    actorId: attacker.teamId,
                    targetId: target.teamId,
                    action: 'attack',
                    damage: 0,
                    isCrit: false,
                    isMiss: true,
                    isCombo,
                    currentHp: target.currentHp,
                    maxHp: target.maxHp,
                    message: NARRATIVES.action(attacker.beastName) + " " + NARRATIVES.dodgeSuccess(target.beastName)
                });
                return;
            }

            // 2. Block Check (Only if dodge fails)
            // Block Chance = 5% + (DEF * 0.5%) (Max 25%)
            let blockChance = 0.05 + (tStats.defense * 0.005);
            blockChance = Math.min(0.25, blockChance);
            const isBlockSuccess = rng.next() < blockChance;

            // 3. Crit Check
            // Crit: MySPR > EnemySPR ? 15% : 0%
            let critChance = aStats.spirit > tStats.spirit ? 0.15 : 0;
            const isCrit = rng.next() < critChance;

            // 4. Spirit Comeback check (HP < 30% && SPR > EnemySPR)
            const isComeback = attacker.currentHp < (attacker.maxHp * 0.3) && aStats.spirit > tStats.spirit;

            // 5. Damage Calculation
            // Base = (10 + MyATK) * (100 / (100 + EnemyDEF))
            let baseDmg = (10 + aStats.atk) * (100 / (100 + tStats.defense));

            let modDmg = baseDmg;
            if (isCrit) modDmg *= 1.5;
            if (isComeback) modDmg *= 1.5;
            if (isBlockSuccess) modDmg *= 0.5;

            // Variance +/- 5% (deterministic)
            const variance = 0.95 + rng.next() * 0.1;
            let finalDmg = Math.round(modDmg * variance);
            finalDmg = Math.max(1, finalDmg);

            // Apply Damage
            target.currentHp = Math.max(0, target.currentHp - finalDmg);

            // Build Narrative Message
            let message = "";
            const attackAction = NARRATIVES.action(attacker.beastName);

            if (isComeback) {
                message = `意志爆發！${attacker.beastName} 展現驚人韌性，力量狂飆！對 ${target.beastName} 造成了 ${finalDmg} 點傷害。`;
            } else if (isCrit) {
                message = `靈光閃現！這一下直擊靈魂核心！對 ${target.beastName} 造成了 ${finalDmg} 點傷害級。`;
            } else if (isCombo) {
                message = `${attacker.beastName} 乘勝追擊，又補了一下！對 ${target.beastName} 造成了 ${finalDmg} 點傷害。`;
            } else if (isBlockSuccess) {
                message = attackAction + " " + NARRATIVES.block(target.beastName, finalDmg);
            } else {
                if (dodgeChance >= 0.1 && rng.next() < 0.4) {
                    message = attackAction + " " + NARRATIVES.dodgeFail(target.beastName) + " " + NARRATIVES.hitResult(target.beastName, finalDmg);
                } else {
                    message = attackAction + " " + NARRATIVES.hitResult(target.beastName, finalDmg);
                }
            }

            logs.push({
                turn,
                actorId: attacker.teamId,
                targetId: target.teamId,
                action: 'attack',
                damage: finalDmg,
                isCrit,
                isMiss: false,
                isCombo,
                currentHp: target.currentHp,
                maxHp: target.maxHp,
                message
            });
        };

        // Main Attack
        performAttack(false);

        // Check Combo
        if (target.currentHp > 0 && state[challenger.teamId].currentHp > 0 && state[defender.teamId].currentHp > 0) {
            // Combo: ((MySPD - EnemySPD) / MySPD) * 50% (Max 40%)
            let comboChance = 0;
            if (attacker.stats.speed > target.stats.speed) {
                comboChance = Math.min(0.4, ((attacker.stats.speed - target.stats.speed) / attacker.stats.speed) * 0.5);
            }

            if (rng.next() < comboChance) {
                performAttack(true);
            }
        }

        if (target.currentHp <= 0) break;
        turn++;
    }

    const winnerId = state[challenger.teamId].currentHp > 0 ? challenger.teamId : defender.teamId;

    return {
        winnerId,
        logs,
        finalHp: {
            [challenger.teamId]: state[challenger.teamId].currentHp,
            [defender.teamId]: state[defender.teamId].currentHp
        }
    };
};
