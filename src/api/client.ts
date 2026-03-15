import axios from 'axios';
import type { LoginResponse, PlayerState, Card, Stats } from '../types';

const GAS_URL = import.meta.env.VITE_GOOGLE_APP_SCRIPT_URL;

// Mock Card Data
const mockCardSword: Card = {
    cardId: 'C001', name: 'Pixel Sword', slot: 'Hand',
    description: 'A basic sword.', stats: { atk: 5, defense: 0, speed: 0, spirit: 0 }, unique: false
};
const mockCardArmor: Card = {
    cardId: 'C002', name: 'Iron Chest', slot: 'Body',
    description: 'Sturdy armor.', stats: { atk: 0, defense: 5, speed: -1, spirit: 0 }, unique: false
};
const mockCardHelm: Card = {
    cardId: 'C003', name: 'Leather Cap', slot: 'Head',
    description: 'Basic headgear.', stats: { atk: 0, defense: 1, speed: 1, spirit: 0 }, unique: false
};

// Mock Data Store
let mockState: PlayerState = {
    team: { teamId: 'TEST01', teamName: '測試小隊', beastName: 'FirePixel', avatarSeed: 'TEST01', points: 0 },
    inventory: [
        { ...mockCardSword, qty: 1 },
        { ...mockCardHelm, qty: 2 }
    ],
    loadout: {
        'Head': null,
        'Body': mockCardArmor,
        'Hand': null,
        'Legs': null
    },
    totalStats: {
        atk: 0, defense: 5, speed: -1, spirit: 0,
        wins: 5, losses: 2, points: 15, Applypoints: 10
    }
};

// Helper to recalc stats
function calculateMockStats(loadout: Record<string, Card | null>): Stats {
    let stats = {
        atk: 0, defense: 0, speed: 0, spirit: 0,
        wins: mockState.totalStats.wins,
        losses: mockState.totalStats.losses,
        points: mockState.totalStats.points,
        Applypoints: mockState.totalStats.Applypoints
    };
    Object.values(loadout).forEach(card => {
        if (card && card.stats) {
            stats.atk += (card.stats.atk || 0);
            stats.defense += (card.stats.defense || 0);
            stats.speed += (card.stats.speed || 0);
            stats.spirit += (card.stats.spirit || 0);
        }
    });
    return stats;
}

export const api = {
    isMock: !GAS_URL,

    async login(teamId: string, password: string): Promise<LoginResponse> {
        if (!GAS_URL) {
            console.warn('Using MOCK LOGIN');
            await new Promise(r => setTimeout(r, 800));

            // Strict Mock Check
            if (teamId === 'TEST01' && password !== '123') {
                return { ok: false, error: 'Wrong Password (Mock: 123)' };
            }

            return { ok: true, state: mockState };
        }

        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'login',
                payload: { teamId, password }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async getPlayerState(teamId: string): Promise<PlayerState> {
        if (!GAS_URL) {
            return mockState;
        }
        const res = await axios.get(`${GAS_URL}?action=getPlayerState&teamId=${teamId}`);
        return res.data;
    },

    async equip(teamId: string, slot: string, cardId: string) {
        if (!GAS_URL) {
            console.log('Mock Equip', slot, cardId);
            const invItemIndex = mockState.inventory.findIndex(i => i.cardId === cardId);
            if (invItemIndex === -1) return { ok: false, error: 'Not in inventory' };

            const item = mockState.inventory[invItemIndex];
            const prevItem = mockState.loadout[slot];

            if (item.qty > 1) {
                mockState.inventory[invItemIndex].qty--;
            } else {
                mockState.inventory.splice(invItemIndex, 1);
            }

            if (prevItem) {
                const prevInvIndex = mockState.inventory.findIndex(i => i.cardId === prevItem.cardId);
                if (prevInvIndex >= 0) mockState.inventory[prevInvIndex].qty++;
                else mockState.inventory.push({ ...prevItem, qty: 1 });
            }

            mockState.loadout[slot] = item;
            mockState.totalStats = calculateMockStats(mockState.loadout); // Update Stats

            return { ok: true, state: { ...mockState } };
        }
        return axios.post(GAS_URL, JSON.stringify({
            action: 'equip',
            payload: { teamId, slot, cardId }
        }), { headers: { 'Content-Type': 'text/plain' } }).then(r => r.data);
    },

    async unequip(teamId: string, slot: string) {
        if (!GAS_URL) {
            console.log('Mock Unequip', slot);
            const item = mockState.loadout[slot];
            if (item) {
                const prevInvIndex = mockState.inventory.findIndex(i => i.cardId === item.cardId);
                if (prevInvIndex >= 0) mockState.inventory[prevInvIndex].qty++;
                else mockState.inventory.push({ ...item, qty: 1 });
                mockState.loadout[slot] = null;
                mockState.totalStats = calculateMockStats(mockState.loadout);
            }
            return { ok: true, state: { ...mockState } };
        }
        try {
            console.log('[API] Sending unequip request:', { teamId, slot });
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'unequip',
                payload: { teamId, slot }
            }), { headers: { 'Content-Type': 'text/plain' } });
            console.log('[API] Unequip response status:', res.status);
            console.log('[API] Unequip response data:', res.data);
            return res.data;
        } catch (error) {
            console.error('[API] Unequip request failed:', error);
            return { ok: false, error: 'Connection Error' };
        }
    },

    async saveLoadout(teamId: string, newLoadout: Record<string, string | null>): Promise<{ ok: boolean, error?: string }> {
        if (!GAS_URL) {
            console.log('Mock Save Loadout', newLoadout);
            return { ok: true };
        }
        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'saveLoadout',
                payload: { teamId, newLoadout }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (error) {
            console.error('[API] Save Loadout failed:', error);
            return { ok: false, error: 'Connection Error' };
        }
    },

    // --- BATTLE SYSTEM APIs ---

    async createChallenge(challengerId: string, defenderId: string) {
        if (!GAS_URL) return { ok: true, battleId: 'MOCK_BATTLE_' + Date.now() };
        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'createChallenge',
                payload: { challengerId, defenderId }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async checkChallenges(teamId: string) {
        if (!GAS_URL) return { ok: true, challenges: [] };
        try {
            // Use GET for lightweight polling
            const res = await axios.get(`${GAS_URL}?action=checkChallenges&teamId=${teamId}`);
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async respondChallenge(battleId: string, teamId: string, accept: boolean) {
        if (!GAS_URL) return { ok: true, status: accept ? 'ACCEPTED' : 'REJECTED' };
        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'respondChallenge',
                payload: { battleId, teamId, accept }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },
    async getBattle(battleId: string) {
        if (!GAS_URL) {
            return {
                ok: true,
                battle: {
                    battleId: battleId,
                    status: 'PENDING',
                    challenger: {
                        teamId: 'TEST01',
                        teamName: 'Mock Challenger',
                        beastName: 'FirePixel',
                        avatarSeed: 'TEST01',
                        stats: { atk: 10, defense: 5, speed: 12, spirit: 3 }
                    },
                    defender: {
                        teamId: 'TEST02',
                        teamName: 'Mock Defender',
                        beastName: 'WaterPixel',
                        avatarSeed: 'TEST02',
                        stats: { atk: 8, defense: 4, speed: 10, spirit: 5 }
                    }
                }
            };
        }
        try {
            const res = await axios.get(`${GAS_URL}?action=getBattle&battleId=${battleId}`);
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async getTeamsList() {
        if (!GAS_URL) {
            return {
                ok: true,
                teams: [
                    { teamId: 'TEST02', teamName: 'Mock Opponent', beastName: 'WaterPixel', avatarSeed: 'TEST02', points: 120 }
                ]
            };
        }
        try {
            const res = await axios.get(`${GAS_URL}?action=getTeamsList`);
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async saveStats(teamId: string, newStats: Partial<Stats>) {
        if (!GAS_URL) {
            console.log('Mock Save Stats', newStats);
            mockState.totalStats = { ...mockState.totalStats, ...newStats };
            return { ok: true, state: { ...mockState } };
        }
        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'saveStats',
                payload: { teamId, newStats }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    },

    async settleBattle(battleId: string, winnerId: string) {
        if (!GAS_URL) {
            console.log('Mock Settle Battle', battleId, winnerId);
            const isWinner = winnerId === mockState.team.teamId;
            const pointsEarned = isWinner ? 4 : 1;
            mockState.totalStats.points = (mockState.totalStats.points || 0) + pointsEarned;
            mockState.totalStats.Applypoints = (mockState.totalStats.Applypoints || 0) + pointsEarned;
            if (isWinner) mockState.totalStats.wins = (mockState.totalStats.wins || 0) + 1;
            else mockState.totalStats.losses = (mockState.totalStats.losses || 0) + 1;

            return { ok: true, pointsEarned };
        }
        try {
            const res = await axios.post(GAS_URL, JSON.stringify({
                action: 'settleBattle',
                payload: { battleId, winnerId }
            }), { headers: { 'Content-Type': 'text/plain' } });
            return res.data;
        } catch (e) {
            return { ok: false, error: 'Connection Error' };
        }
    }
};
