import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';

export const BattleLobby: React.FC = () => {
    const navigate = useNavigate();
    const teamId = localStorage.getItem('teamId');
    const [selectedOpponent, setSelectedOpponent] = useState<{ id: string, name: string } | null>(null);
    const [currentBattleId, setCurrentBattleId] = useState<string | null>(null);

    // Fetch Team List
    const { data: teamsData, isLoading, error } = useQuery({
        queryKey: ['teamsList'],
        queryFn: async () => {
            console.log('Fetching teams list...');
            const result = await api.getTeamsList();
            console.log('Teams List Result:', result);
            return result;
        },
        enabled: !!teamId,
    });

    // Create Challenge Mutation
    const challengeMutation = useMutation({
        mutationFn: (defenderId: string) => api.createChallenge(teamId!, defenderId),
        onSuccess: (data) => {
            if (data.ok) {
                // toast.success('挑戰書已送出！請等待對方回應...');
                // Don't close modal, switch to waiting state
                setCurrentBattleId(data.battleId);
                // setSelectedOpponent(null); // Keep opponent selected to show name
            } else {
                toast.error('發送失敗: ' + data.error);
                setSelectedOpponent(null);
            }
        },
        onError: () => toast.error('連線錯誤')
    });

    // Poll for status when we have a battleId (Waiting for acceptance)
    const { data: battleStatus } = useQuery({
        queryKey: ['checkChallengeStatus', currentBattleId],
        queryFn: async () => {
            if (!currentBattleId) return null;
            const res = await api.checkChallenges(teamId!);
            return res;
        },
        enabled: !!currentBattleId,
        refetchInterval: 2000, // Faster polling
        select: (data) => {
            // Find our specific battle
            if (!data || !data.challenges) return null;
            // We are the challenger, so we look for challenges where we are challenger
            return data.challenges.find((c: any) => c.battleId === currentBattleId);
        }
    });

    // Effect to handle navigation when Accepted
    React.useEffect(() => {
        if (battleStatus && battleStatus.status === 'ACCEPTED') {
            toast.success('對方已接受！進入戰鬥...');
            navigate(`/battle/${battleStatus.battleId}`);
        } else if (battleStatus && battleStatus.status === 'REJECTED') {
            toast.error('對方拒絕了挑戰');
            setCurrentBattleId(null);
            setSelectedOpponent(null);
        }
    }, [battleStatus, navigate]);


    const handleChallenge = () => {
        if (selectedOpponent && teamId) {
            challengeMutation.mutate(selectedOpponent.id);
        }
    };

    if (!teamId) {
        navigate('/login');
        return null;
    }

    const availableTeams = (teamsData?.teams || [])
        .filter((t: any) => t.teamId !== teamId)
        .sort((a: any, b: any) => (b.points || 0) - (a.points || 0));

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 font-pixel">
            <div className="max-w-4xl mx-auto">
                {/* ... existing UI ... */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl text-yellow-500">對戰大廳</h1>
                    <Button onClick={() => navigate('/dashboard')}>返回儀表板</Button>
                </div>

                {isLoading ? (
                    <div className="text-center text-xl">讀取中...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {availableTeams.length === 0 && (
                            <div className="col-span-full text-center text-gray-500 py-20 text-xl border-4 border-dashed border-gray-700 rounded-lg">
                                <p>😴 目前沒有其他隊伍...</p>
                                <p className="text-sm mt-2">請確認後端是否已部署最新版本</p>
                            </div>
                        )}
                        {availableTeams.map((team: any) => (
                            <div key={team.teamId} className="bg-gray-800 border-4 border-gray-600 p-4 rounded-lg flex flex-col items-center gap-4 relative transition-transform hover:-translate-y-1">
                                <img
                                    src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${team.avatarSeed}`}
                                    alt="Avatar"
                                    className="w-24 h-24 border-2 border-white rounded bg-gray-700 pixelated"
                                />
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-yellow-400">{team.teamName}</h3>
                                    <p className="text-gray-400 text-sm">靈獸: {team.beastName}</p>
                                    <div className="mt-1 bg-black/30 px-2 py-0.5 rounded border border-yellow-600/30 inline-block">
                                        <span className="text-xs text-yellow-500 font-bold">積分: {team.points || 0}</span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full mt-auto"
                                    onClick={() => setSelectedOpponent({ id: team.teamId, name: team.teamName })}
                                    disabled={challengeMutation.isPending || !!currentBattleId}
                                >
                                    發起挑戰
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Full Screen Loading Overlay for Challenge */}
                {(challengeMutation.isPending || !!currentBattleId) && (
                    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center">
                        <div className="loading-bar w-64 mb-8" />
                        <h2 className="text-3xl text-white animate-pulse">
                            {challengeMutation.isPending ? '傳送挑戰中...' : '等待對手回應...'}
                        </h2>
                        {!!currentBattleId && (
                            <p className="text-gray-400 mt-4">請稍候，對方正在決定是否接受...</p>
                        )}
                    </div>
                )}

                {/* Confirm Dialog (Only show if NOT loading/waiting) */}
                {selectedOpponent && !challengeMutation.isPending && !currentBattleId && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="bg-gray-800 border-4 border-yellow-500 p-6 max-w-sm w-full text-center">
                            <h2 className="text-2xl mb-4 text-white">發起邀請</h2>
                            <p className="mb-6 text-gray-300">
                                確定要向 <span className="text-yellow-400 font-bold">{selectedOpponent.name}</span> 發起挑戰嗎？
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    onClick={handleChallenge}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={challengeMutation.isPending}
                                >
                                    確認開戰
                                </Button>
                                <Button
                                    onClick={() => setSelectedOpponent(null)}
                                    className="bg-gray-600 hover:bg-gray-700"
                                    disabled={challengeMutation.isPending}
                                >
                                    取消
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
