import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { PixelSlot } from '../components/PixelSlot';
import { PixelCard } from '../components/PixelCard';
import type { PlayerState, InventoryItem, Card, Stats } from '../types';
import toast from 'react-hot-toast';
import { Button } from '../components/Button';
import clsx from 'clsx';

const DEFAULT_SLOTS = ["Head", "Body", "Hand", "Legs", "Accessory"];
const SLOTS: string[] = import.meta.env.VITE_SLOTS ? JSON.parse(import.meta.env.VITE_SLOTS) : DEFAULT_SLOTS;

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const teamId = localStorage.getItem('teamId');

    // Local Draft State
    const [draftLoadout, setDraftLoadout] = useState<Record<string, Card | null>>({});
    const [draftInventory, setDraftInventory] = useState<InventoryItem[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmingAccept, setIsConfirmingAccept] = useState(false);

    // Attribute Allocation State
    const [draftBaseStats, setDraftBaseStats] = useState<Stats | null>(null);
    const [availablePoints, setAvailablePoints] = useState(0);

    // Server State
    const { data: serverState, isLoading } = useQuery<PlayerState>({
        queryKey: ['playerState', teamId],
        queryFn: () => api.getPlayerState(teamId!),
        enabled: !!teamId,
        refetchInterval: 30000,
    });

    // Sync draft with server when not dirty
    useEffect(() => {
        if (serverState && !isDirty) {
            setDraftLoadout(serverState.loadout);
            setDraftInventory(JSON.parse(JSON.stringify(serverState.inventory)));

            // Sync base stats (the stats stored in serverState.totalStats before equip calc)
            // Wait, calculateDraftStats adds equip to base.
            // Let's assume serverState.totalStats contains the "Base" stats (allocated).
            setDraftBaseStats({ ...serverState.totalStats });
            setAvailablePoints(serverState.totalStats.Applypoints || 0);
        }
    }, [serverState, isDirty]);

    // Redirect if no login
    useEffect(() => {
        if (!teamId) navigate('/login');
    }, [teamId, navigate]);

    // [BATTLE] Polling for Challenges
    const { data: challengesData } = useQuery({
        queryKey: ['challenges'],
        queryFn: async () => {
            const res = await api.checkChallenges(teamId!);
            console.log('Poll Challenges:', res); // DEBUG
            return res;
        },
        enabled: !!teamId,
        refetchInterval: 5000,
    });

    // Filter for INCOMING challenges only
    // Logic: If I am polling checkChallenges(myId), and it returns a PENDING challenge,
    // it inherently means I am the defender (backend logic).
    const pendingChallenge = challengesData?.challenges?.find(
        (c: any) => {
            const isPending = c.status === 'PENDING';
            // Backend omits defenderId in the list when we poll as defender.
            // So we should rely on the fact that if it's here, it's for us.
            // BUT we must check we are NOT the challenger (just in case)
            const isNotMyChallenge = String(c.challengerId).trim() !== String(teamId).trim();
            console.log(`Challenge ${c.battleId}: Status=${c.status}, Challenger=${c.challigerId}, Me=${teamId}, IsIncoming=${isPending && isNotMyChallenge}`);
            return isPending && isNotMyChallenge;
        }
    );

    // [BATTLE] Respond Mutation
    const respondMutation = useMutation({
        mutationFn: ({ battleId, accept }: { battleId: string, accept: boolean }) =>
            api.respondChallenge(battleId, teamId!, accept),
        onSuccess: (data, variables) => {
            if (variables.accept && (data.ok || data.status === 'ACCEPTED')) {
                toast.success('接受挑戰！進入戰鬥...');
                // Navigate to Battle Page
                navigate(`/battle/${variables.battleId}`);
            } else {
                toast('已拒絕挑戰');
            }
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
        },
        onError: () => toast.error('回應失敗')
    });

    // Helper: Calculate Stats Locally
    const calculateDraftStats = () => {
        if (!draftBaseStats) return { atk: 0, defense: 0, speed: 0, spirit: 0 };
        let stats = { ...draftBaseStats };
        Object.values(draftLoadout).forEach(card => {
            if (card && card.stats) {
                stats.atk += (card.stats.atk || 0);
                stats.defense += (card.stats.defense || 0);
                stats.speed += (card.stats.speed || 0);
                stats.spirit += (card.stats.spirit || 0);
            }
        });
        return stats;
    };

    const currentStats = calculateDraftStats();

    // Allocation Handler
    const handleAllocate = (stat: keyof Stats, delta: number) => {
        if (!draftBaseStats) return;
        if (delta > 0 && availablePoints <= 0) return;
        if (delta < 0) {
            // Cannot go below server original baseline
            const originalValue = serverState?.totalStats[stat] || 0;
            if ((draftBaseStats[stat] as number) <= (originalValue as number)) return;
        }

        setDraftBaseStats(prev => prev ? { ...prev, [stat]: (prev[stat] as number) + delta } : null);
        setAvailablePoints(prev => prev - delta);
        setIsDirty(true);
    };

    // Handlers
    const handleEquip = (slot: string, card: Card) => {
        // 1. Check if card exists in draftInventory
        const invIndex = draftInventory.findIndex(i => i.cardId === card.cardId && i.qty > 0);
        if (invIndex === -1) {
            toast.error('背包中沒有此卡片');
            return;
        }

        const newInv = [...draftInventory];
        const newLoadout = { ...draftLoadout };

        // 2. Reduce inventory qty
        // Create a new object for the item to avoid mutation
        newInv[invIndex] = { ...newInv[invIndex] };

        if (newInv[invIndex].qty > 1) {
            newInv[invIndex].qty--;
        } else {
            newInv.splice(invIndex, 1);
        }

        // 3. If slot has item, return to inventory
        const currentItem = newLoadout[slot];
        if (currentItem) {
            const existingInvIndex = newInv.findIndex(i => i.cardId === currentItem.cardId);
            if (existingInvIndex >= 0) {
                newInv[existingInvIndex] = { ...newInv[existingInvIndex], qty: newInv[existingInvIndex].qty + 1 };
            } else {
                newInv.push({ ...currentItem, qty: 1 } as InventoryItem);
            }
        }

        // 4. Update loadout
        newLoadout[slot] = card;

        setDraftInventory(newInv);
        setDraftLoadout(newLoadout);
        setIsDirty(true);
        setSelectedSlot(null);
    };

    const handleUnequip = (slot: string) => {
        const currentItem = draftLoadout[slot];
        if (!currentItem) return;

        const newInv = [...draftInventory];
        const newLoadout = { ...draftLoadout };

        // 1. Move to inventory
        const existingInvIndex = newInv.findIndex(i => i.cardId === currentItem.cardId);
        if (existingInvIndex >= 0) {
            newInv[existingInvIndex] = { ...newInv[existingInvIndex], qty: newInv[existingInvIndex].qty + 1 };
        } else {
            newInv.push({ ...currentItem, qty: 1 } as InventoryItem);
        }

        // 2. Clear slot
        newLoadout[slot] = null;

        setDraftInventory(newInv);
        setDraftLoadout(newLoadout);
        setIsDirty(true);
    };

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            setIsSaving(true);
            try {
                // 1. Save Loadout
                const loadoutIds: Record<string, string | null> = {};
                Object.keys(draftLoadout).forEach(key => {
                    loadoutIds[key] = draftLoadout[key]?.cardId || null;
                });
                const lRes = await api.saveLoadout(teamId!, loadoutIds);
                if (!lRes.ok) throw new Error(lRes.error);

                // 2. Save Base Stats (Allocated)
                if (draftBaseStats) {
                    const statsRes = await api.saveStats(teamId!, {
                        ...draftBaseStats,
                        Applypoints: availablePoints
                    });
                    if (!statsRes.ok) throw new Error(statsRes.error);
                }

                return { ok: true };
            } finally {
                setIsSaving(false);
            }
        },
        onSuccess: (data) => {
            if (data.ok) {
                toast.success('儲存成功！');
                // Optimistically update the cache with our draft state
                // This prevents the UI from flickering back to old state before refetch
                queryClient.setQueryData(['playerState', teamId], (old: PlayerState | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        inventory: draftInventory,
                        loadout: draftLoadout,
                        totalStats: calculateDraftStats()
                    };
                });

                setIsDirty(false);
                queryClient.setQueryData(['playerState', teamId], (old: PlayerState | undefined) => {
                    if (!old) return old;
                    return {
                        ...old,
                        inventory: draftInventory,
                        loadout: draftLoadout,
                        totalStats: {
                            ...draftBaseStats!,
                            Applypoints: availablePoints
                        }
                    };
                });
                queryClient.invalidateQueries({ queryKey: ['playerState', teamId] });
            } else {
                toast.error(typeof data === 'string' ? data : (data.error || '儲存失敗'));
            }
            setIsSaving(false);
        },
        onError: () => {
            toast.error('連線錯誤');
            setIsSaving(false);
        }
    });

    const handleReset = () => {
        if (window.confirm('確定要放棄所有更動嗎？')) {
            setIsDirty(false);
            if (serverState) {
                setDraftLoadout(serverState.loadout);
                setDraftInventory(JSON.parse(JSON.stringify(serverState.inventory)));
            }
        }
    };

    if (isLoading || !serverState) return <div className="container text-white p-4">LOADING... <div className="loading-bar" /></div>;

    const { team } = serverState;
    const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${team.avatarSeed}`;

    // Filter inventory based on slot
    const filteredInventory = selectedSlot
        ? draftInventory.filter(item => item.slot === selectedSlot)
        : draftInventory;


    return (
        <div className="min-h-screen bg-gray-900 text-white font-pixel pb-20">
            {/* Full Screen Loading Overlay for Save/Response */}
            {(isSaving || respondMutation.isPending) && (
                <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center">
                    <div className="loading-bar w-64 mb-8" />
                    <h2 className="text-3xl text-white animate-pulse">
                        {respondMutation.isPending ? '建立連結中...' : '資料同步中...'}
                    </h2>
                </div>
            )}

            {/* Dirty State Banner */}
            {isDirty && (
                <div className="bg-yellow-600 text-white p-2 flex justify-between items-center sticky top-0 z-50 border-b-4 border-white shadow-lg animate-pulse">
                    <span className="font-bold">⚠️ 有未儲存的更動</span>
                    <div className="flex gap-2">
                        <Button
                            variant="danger"
                            onClick={handleReset}
                            className="text-xs py-1"
                        >
                            放棄
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => saveMutation.mutate()}
                            disabled={isSaving}
                            className="text-xs py-1"
                        >
                            {isSaving ? '儲存中...' : '確認儲存'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Challenge Modal */}
            {pendingChallenge && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
                    {!isConfirmingAccept ? (
                        <div className="bg-gray-800 border-4 border-red-500 p-6 max-w-sm w-full text-center animate-bounce">
                            <h2 className="text-3xl mb-4 text-red-500 font-bold">⚠️ 遭遇戰 ⚠️</h2>
                            <p className="mb-6 text-white text-lg">
                                來自 <span className="text-yellow-400 font-bold">{pendingChallenge.challengerId}</span> 的挑戰！
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    variant="danger"
                                    onClick={() => setIsConfirmingAccept(true)}
                                    disabled={respondMutation.isPending}
                                >
                                    接受
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => respondMutation.mutate({ battleId: pendingChallenge.battleId, accept: false })}
                                    disabled={respondMutation.isPending}
                                >
                                    拒絕
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-800 border-4 border-yellow-500 p-6 max-w-sm w-full text-center">
                            <h2 className="text-2xl mb-4 text-white">進入戰鬥？</h2>
                            <p className="mb-6 text-gray-300">
                                確定要進入對戰了嗎？
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    variant="danger"
                                    onClick={() => {
                                        respondMutation.mutate({ battleId: pendingChallenge.battleId, accept: true });
                                        setIsConfirmingAccept(false);
                                    }}
                                    disabled={respondMutation.isPending}
                                >
                                    進入戰鬥
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsConfirmingAccept(false)}
                                    disabled={respondMutation.isPending}
                                >
                                    返回
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Team Header */}
            <div className="bg-gray-800/80 p-6 m-4 rounded border-4 border-gray-600 flex flex-col md:flex-row gap-6 items-center shadow-lg backdrop-blur-sm">
                <div className="relative">
                    <img src={avatarUrl} alt="Avatar" className="w-24 h-24 border-4 border-white bg-gray-700 rounded-lg shadow-md object-cover pixelated" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h2 className="text-2xl text-yellow-400 font-bold mb-2 shadow-black drop-shadow-md flex flex-col md:flex-row gap-2 items-center md:items-baseline justify-center md:justify-start">
                        {team.teamName} <span className="text-base text-gray-400 font-normal">({team.beastName})</span>
                    </h2>

                    {/* Points & Stats Row */}
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-6 items-center justify-center md:justify-start">
                            <div className="bg-black/40 px-3 py-1 rounded border border-yellow-600/50">
                                <span className="text-xs text-gray-400 block">總積分</span>
                                <span className="text-xl text-yellow-500 font-bold">{serverState.totalStats.points || 0}</span>
                            </div>
                            <div className="bg-black/40 px-3 py-1 rounded border border-blue-600/50">
                                <span className="text-xs text-gray-400 block">可分配分數</span>
                                <span className="text-xl text-blue-400 font-bold">{availablePoints}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                                勝: {serverState.totalStats.wins || 0} / 敗: {serverState.totalStats.losses || 0}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                            <StatBox label="ATK" value={currentStats.atk} color="#ff5555" onAllocate={(d) => handleAllocate('atk', d)} canAllocate={availablePoints > 0} canDeallocate={(draftBaseStats?.atk || 0) > (serverState.totalStats.atk || 0)} />
                            <StatBox label="DEF" value={currentStats.defense} color="#5555ff" onAllocate={(d) => handleAllocate('defense', d)} canAllocate={availablePoints > 0} canDeallocate={(draftBaseStats?.defense || 0) > (serverState.totalStats.defense || 0)} />
                            <StatBox label="SPD" value={currentStats.speed} color="#55ff55" onAllocate={(d) => handleAllocate('speed', d)} canAllocate={availablePoints > 0} canDeallocate={(draftBaseStats?.speed || 0) > (serverState.totalStats.speed || 0)} />
                            <StatBox label="SPR" value={currentStats.spirit} color="#ffff55" onAllocate={(d) => handleAllocate('spirit', d)} canAllocate={availablePoints > 0} canDeallocate={(draftBaseStats?.spirit || 0) > (serverState.totalStats.spirit || 0)} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2 items-center">
                    <Button
                        onClick={() => navigate('/lobby')}
                        className="bg-red-700 hover:bg-red-600 border-red-900 border-b-4 active:border-b-0 w-full md:w-auto px-6 py-3 text-lg shadow-lg animate-pulse"
                    >
                        ⚔️ 前往對戰大廳
                    </Button>
                    <div className="flex gap-2 text-xs text-gray-400 mt-2">
                        <button onClick={() => { localStorage.removeItem('teamId'); navigate('/login'); }} className="hover:text-white underline">
                            登出
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-8 p-4 max-w-6xl mx-auto">
                {/* Top: Loadout (Horizontal Row) */}
                <div className="bg-gray-800/50 p-6 rounded border-2 border-gray-700 w-full">
                    <h3 className="text-xl border-b-4 border-white pb-2 mb-4 font-bold text-yellow-300">裝備欄位</h3>
                    <div className="flex flex-row flex-wrap justify-between md:justify-start gap-6">
                        {SLOTS.map(slot => (
                            <div key={slot} className="flex flex-col items-center">
                                <span className="text-xs text-gray-400 mb-1">{slot}</span>
                                <PixelSlot
                                    slotName={slot}
                                    equippedCard={draftLoadout[slot] || null}
                                    isSelected={selectedSlot === slot}
                                    onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)}
                                    onUnequip={() => handleUnequip(slot)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom: Inventory */}
                <div className="bg-gray-800/50 p-4 rounded border-2 border-gray-700 flex flex-col min-h-[400px]">
                    <h3 className="text-xl border-b-4 border-white pb-2 mb-4 font-bold text-cyan-300 flex justify-between items-center">
                        <span>背包 {selectedSlot ? `(分類: ${selectedSlot})` : '(全部)'}</span>
                        {selectedSlot && (
                            <button
                                onClick={() => setSelectedSlot(null)}
                                className="text-xs bg-gray-600 px-2 py-1 rounded hover:bg-gray-500"
                            >
                                顯示全部
                            </button>
                        )}
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 overflow-y-auto p-4 bg-black/20 rounded flex-1">
                        {filteredInventory.length === 0 && (
                            <div className="col-span-full text-center p-8 text-gray-500 italic flex flex-col items-center justify-center h-full">
                                <span className="text-4xl mb-2">🎒</span>
                                {selectedSlot ? '此部位沒有裝備' : '背包是空的'}
                            </div>
                        )}
                        {filteredInventory.map(item => (
                            <div key={item.cardId} onClick={() => {
                                if (selectedSlot && item.slot === selectedSlot) {
                                    handleEquip(selectedSlot, item);
                                } else if (!selectedSlot) {
                                    toast('請先選擇上方裝備欄位', { icon: '👆' });
                                }
                            }} className="cursor-pointer transition-transform hover:scale-105 active:scale-95">
                                <PixelCard
                                    card={item}
                                    quantity={item.qty}
                                    isValidTarget={selectedSlot === item.slot}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, color, onAllocate, canAllocate, canDeallocate }: {
    label: string,
    value: number,
    color: string,
    onAllocate?: (delta: number) => void,
    canAllocate?: boolean,
    canDeallocate?: boolean
}) => (
    <div style={{ background: '#333', padding: '5px', border: `2px solid ${color}`, textAlign: 'center', minWidth: '70px', position: 'relative' }}>
        <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '18px', color, fontWeight: 'bold' }}>{value}</div>
        {onAllocate && (
            <div className="flex justify-center gap-1 mt-1">
                <button
                    disabled={!canDeallocate}
                    onClick={() => onAllocate(-1)}
                    className={clsx("w-5 h-5 flex items-center justify-center rounded text-[10px] border", canDeallocate ? "bg-red-900/50 border-red-500" : "bg-gray-800 border-gray-600 opacity-30 cursor-not-allowed")}
                >
                    -
                </button>
                <button
                    disabled={!canAllocate}
                    onClick={() => onAllocate(1)}
                    className={clsx("w-5 h-5 flex items-center justify-center rounded text-[10px] border", canAllocate ? "bg-green-900/50 border-green-500" : "bg-gray-800 border-gray-600 opacity-30 cursor-not-allowed")}
                >
                    +
                </button>
            </div>
        )}
    </div>
);
