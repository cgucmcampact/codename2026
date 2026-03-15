
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { simulateBattle, type BattleLog } from '../utils/battleEngine';
import clsx from 'clsx';

export const Battle: React.FC = () => {
    const { battleId } = useParams<{ battleId: string }>();
    const navigate = useNavigate();
    const teamId = localStorage.getItem('teamId');

    const [logs, setLogs] = useState<BattleLog[]>([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    // Battle State for Animation
    const [challengerHp, setChallengerHp] = useState(200);
    const [defenderHp, setDefenderHp] = useState(200);

    const [battleResult, setBattleResult] = useState<{ winnerId: string, pointsEarned?: number } | null>(null);

    // Fetch Battle Data
    const { data, isLoading, error } = useQuery({
        queryKey: ['battle', battleId],
        queryFn: () => api.getBattle(battleId!),
        enabled: !!battleId,
    });

    // Run Simulation ONCE when data is ready
    useEffect(() => {
        if (data?.ok && data.battle && logs.length === 0) {
            const { challenger, defender } = data.battle;
            console.log('Running Simulation...', challenger, defender);
            const result = simulateBattle(challenger, defender, battleId!);
            setLogs(result.logs);
            setBattleResult({ winnerId: result.winnerId });

            // Initial HP is 200 as per simulation.
            setChallengerHp(200);
            setDefenderHp(200);
        }
    }, [data, battleId, logs.length]);

    // Settlement Logic: Call API when battle finishes
    const hasSettled = useRef(false);
    useEffect(() => {
        if (isFinished && battleResult && !hasSettled.current) {
            hasSettled.current = true;
            console.log('Settling battle...', battleId, battleResult.winnerId);
            api.settleBattle(battleId!, battleResult.winnerId).then(res => {
                console.log('Settlement result:', res);
                if (res.ok) {
                    setBattleResult(prev => prev ? { ...prev, pointsEarned: res.pointsEarned } : null);
                }
            });
        }
    }, [isFinished, battleResult, battleId]);

    // Auto-Play Logs
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logs.length > 0 && currentStep < logs.length) {
            const timer = setTimeout(() => {
                const log = logs[currentStep];

                // Update HP
                if (data?.battle) {
                    const isChallengerHit = log.targetId === data.battle.challenger.teamId;
                    if (isChallengerHit) {
                        setChallengerHp(log.currentHp);
                    } else {
                        setDefenderHp(log.currentHp);
                    }
                }

                setCurrentStep(prev => prev + 1);

                // Auto Scroll
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 1000); // 1.0s per turn (Standard)
            return () => clearTimeout(timer);
        } else if (logs.length > 0 && currentStep >= logs.length) {
            setIsFinished(true);
        }
    }, [logs, currentStep, data]);


    if (isLoading) return <div className="p-8 text-center text-white">Loading Battle...</div>;
    if (error || !data?.ok) return <div className="p-8 text-center text-red-500">Error loading battle: {data?.error}</div>;

    const { challenger, defender } = data.battle;
    const isChallenger = teamId === challenger.teamId;

    return (
        <div className="min-h-screen bg-gray-900 text-white font-pixel p-2 flex flex-col items-center">
            {/* Top Bar (Health Info for Both) */}
            <div className="w-full max-w-lg bg-gray-800 p-4 rounded-b-xl border-b-4 border-gray-700 mb-4 grid grid-cols-2 gap-4 shadow-xl">
                {/* Opponent */}
                <div className="flex flex-col items-start border-r-2 border-gray-700 pr-4">
                    <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-1">Opponent</div>
                    <div className="flex items-center gap-3 w-full">
                        <img
                            src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${isChallenger ? defender.avatarSeed : challenger.avatarSeed}`}
                            className="w-12 h-12 bg-gray-700 rounded border-2 border-white shadow-inner"
                            alt="Enemy"
                        />
                        <div className="flex-1 overflow-hidden">
                            <div className="text-lg truncate">{isChallenger ? defender.beastName : challenger.beastName}</div>
                            <div className="w-full h-3 bg-gray-700 mt-1 rounded-full overflow-hidden border border-gray-900">
                                <div
                                    className="h-full bg-red-500 transition-all duration-300"
                                    style={{ width: `${((isChallenger ? defenderHp : challengerHp) / 200) * 100}%` }}
                                />
                            </div>
                            <div className="text-right text-xs mt-0.5 text-gray-400">
                                {isChallenger ? defenderHp : challengerHp}hp / 200hp
                            </div>
                        </div>
                    </div>
                </div>

                {/* Player (Self) */}
                <div className="flex flex-col items-end pl-4">
                    <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Player</div>
                    <div className="flex items-center gap-3 w-full flex-row-reverse">
                        <img
                            src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${isChallenger ? challenger.avatarSeed : defender.avatarSeed}`}
                            className="w-12 h-12 bg-gray-700 rounded border-2 border-white shadow-inner"
                            alt="Player"
                        />
                        <div className="flex-1 overflow-hidden text-right">
                            <div className="text-lg truncate">{isChallenger ? challenger.beastName : defender.beastName}</div>
                            <div className="w-full h-3 bg-gray-700 mt-1 rounded-full overflow-hidden border border-gray-900">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300 float-right"
                                    style={{ width: `${((isChallenger ? challengerHp : defenderHp) / 200) * 100}%` }}
                                />
                            </div>
                            <div className="text-left text-xs mt-0.5 text-gray-400">
                                {isChallenger ? challengerHp : defenderHp}hp / 200hp
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Battle Log Area */}
            <div
                ref={scrollRef}
                className="flex-1 w-full max-w-md bg-black/50 border-4 border-gray-700 p-4 overflow-y-auto mb-4 rounded-lg space-y-3"
                style={{ maxHeight: '60vh' }}
            >
                {logs.slice(0, currentStep).map((log, index) => {
                    const isMe = log.actorId === teamId;
                    return (
                        <div key={index} className={clsx("p-2 rounded text-sm", isMe ? "bg-blue-900/30 text-blue-200" : "bg-red-900/30 text-red-200")}>
                            <span className="text-xs text-gray-500 mr-2">T{log.turn}</span>
                            {log.message}
                        </div>
                    );
                })}
                {logs.length === 0 && <div className="text-center text-gray-500 mt-10">戰鬥即將開始...</div>}
                {isFinished && (
                    <div className="text-center py-6 bg-gray-800/80 rounded-lg border-2 border-yellow-500 shadow-2xl animate-pulse mt-4">
                        <div className="text-3xl font-bold text-yellow-400 mb-2 px-4">
                            {(() => {
                                const winnerId = battleResult?.winnerId;
                                const winner = winnerId === challenger.teamId ? challenger : defender;
                                return `${winner.beastName} 獲得了最終勝利`;
                            })()}
                        </div>
                        {battleResult?.pointsEarned !== undefined && (
                            <div className="text-xl text-green-400 mb-4">獲得了 {battleResult.pointsEarned} 點積分！</div>
                        )}
                        <Button onClick={() => navigate('/dashboard')} variant="primary" className="px-8 py-3 text-xl">
                            返回列表
                        </Button>
                    </div>
                )}
            </div>

            {/* Bottom space filler instead of fixed bar */}
            <div className="h-4" />
        </div>
    );
};
