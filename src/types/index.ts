export type SlotType = 'Head' | 'Body' | 'Hand' | 'Legs' | 'Accessory' | 'Artifact';

export interface Stats {
    atk: number;
    defense: number;
    speed: number;
    spirit: number;
    wins?: number;
    losses?: number;
    points?: number;
    Applypoints?: number;
}

export interface Card {
    cardId: string;
    name: string;
    slot: SlotType; // Updated to use the type
    description: string;
    stats: Stats;
    unique: boolean;
    image?: string;
}

export interface InventoryItem extends Card {
    qty: number;
}

export interface Team {
    teamId: string;
    teamName: string;
    beastName: string;
    avatarSeed: string;
    points?: number; // For lobby display
}

export interface PlayerState {
    team: Team;
    inventory: InventoryItem[]; // Pre-joined Inventory
    loadout: Record<string, Card | null>; // Pre-joined Loadout (Slot -> Card Object or null)
    totalStats: Stats;
}

export interface LoginResponse {
    ok: boolean;
    error?: string;
    state?: PlayerState;
}

export interface AdminState {
    teams: PlayerState[];
    cards: Card[];
}

export type BattleStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';

export interface Challenge {
    battleId: string;
    challengerId?: string;
    defenderId?: string;
    status: BattleStatus;
}

export interface BattleInitData {
    ok: boolean;
    status: BattleStatus;
    challenger?: { id: string; stats: Stats };
    defender?: { id: string; stats: Stats };
}

// BattleParticipant Interface
export interface BattleParticipant {
    teamId: string;
    teamName: string;
    beastName: string;
    avatarSeed: string;
    stats: Stats;
}

export interface BattleState {
    battleId: string;
    status: BattleStatus;
    challenger: BattleParticipant;
    defender: BattleParticipant;
}
