import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ApiService, getApiMode, registerBroadcastListener, postLocalBroadcast } from '../services/api';
import { CARDS, calculateRoundEffects, RARITY_COLORS, convertGoogleDriveUrl } from '../services/cardData';
import {
  Swords, Trophy, Users, RefreshCw,
  Hourglass, AlertCircle, PlayCircle, Info
} from 'lucide-react';

export default function BattleTab({ player, onPlayerUpdate, activeBattleId, onClearBattleId, onStartBattle, onSentInvitationChange }) {
  const [battleId, setBattleId] = useState(() => {
    // 惰性載入，防範 React 18+ 雙次掛載造成的對戰 ID 丟失
    return localStorage.getItem('sa_active_battle_id') || null;
  });
  const [battleState, setBattleState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 大廳狀態
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [sentInvitation, setSentInvitation] = useState(null); // { id, receiver_id, receiver_name, time }
  const [isOpponentAccepted, setIsOpponentAccepted] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [sentInviteTimeLeft, setSentInviteTimeLeft] = useState(30);

  // 戰績統計 (localStorage 存儲)
  const statsUpdatedRef = useRef(false);
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem(`tcm_stats_${player.id}`);
    return saved ? JSON.parse(saved) : { total: 0, wins: 0, losses: 0 };
  });

  // 戰鬥狀態
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [usedCardIds, setUsedCardIds] = useState([]); // 記錄此局已使用的手牌
  const [actionSubmitted, setActionSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3 分鐘 (180秒)
  const [shakingPlayer, setShakingPlayer] = useState(null); // 'p1' | 'p2' | null 用于受击震动效果

  // 戰鬥流程修正狀態
  const [localRoundNumber, setLocalRoundNumber] = useState(1);
  const [showReveal, setShowReveal] = useState(false);
  const [showRoundBanner, setShowRoundBanner] = useState(false);
  const [roundBannerNum, setRoundBannerNum] = useState(1);
  const [roundTimeLeft, setRoundTimeLeft] = useState(15);
  const [activeCardDetail, setActiveCardDetail] = useState(null);

  const pollingInterval = useRef(null);
  const prevHpRef = useRef({ p1: null, p2: null });
  const animatingRoundRef = useRef(null);
  const battleIdRef = useRef(battleId);
  const battleStateRef = useRef(battleState);
  const lastSentInvitationIdRef = useRef(null);

  const isP1 = battleState ? (String(player.id || '').toLowerCase() === String(battleState.p1_id || '').toLowerCase()) : true;
  const myRole = isP1 ? 'p1' : 'p2';
  const isMyTurn = battleState ? (
    (battleState.p1_action === 'waiting' && myRole === 'p1') ||
    (battleState.p1_action !== 'waiting' && battleState.p2_action === 'waiting' && myRole === 'p2')
  ) : false;
  const meObj = battleState ? (isP1 ? {
    id: battleState.p1_id,
    hp: battleState.p1_hp,
    maxHp: battleState.p1_max_hp,
    def: battleState.p1_def,
    atk: battleState.p1_atk,
    action: battleState.p1_action,
    role: 'p1'
  } : {
    id: battleState.p2_id,
    hp: battleState.p2_hp,
    maxHp: battleState.p2_max_hp,
    def: battleState.p2_def,
    atk: battleState.p2_atk,
    action: battleState.p2_action,
    role: 'p2'
  }) : null;

  const oppObj = battleState ? (!isP1 ? {
    id: battleState.p1_id,
    hp: battleState.p1_hp,
    maxHp: battleState.p1_max_hp,
    def: battleState.p1_def,
    atk: battleState.p1_atk,
    action: battleState.p1_action,
    role: 'p1'
  } : {
    id: battleState.p2_id,
    hp: battleState.p2_hp,
    maxHp: battleState.p2_max_hp,
    def: battleState.p2_def,
    atk: battleState.p2_atk,
    action: battleState.p2_action,
    role: 'p2'
  }) : null;

  // 0. 監聽 prop 傳入的 activeBattleId
  useEffect(() => {
    if (activeBattleId) {
      if (activeBattleId !== battleId) {
        setSentInvitation(null);
        setIsOpponentAccepted(false);
        startBattle(activeBattleId);
      }
    } else {
      if (battleId !== null) {
        resetBattleSession();
      }
    }
  }, [activeBattleId]);

  // 1. 統一狀態輪詢定時器 (大廳, 邀請, 或是對戰)
  useEffect(() => {
    // 每次狀態改變時，清空舊的定時器
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }

    if (battleId) {
      // 對戰狀態輪詢 (2秒)
      fetchBattleState(battleId);
      pollingInterval.current = setInterval(() => {
        fetchBattleState(battleId);
      }, 2000);
    } else if (sentInvitation) {
      // 雲端模式下交由 App.jsx 輪詢 checkInvitations，本地模式靠 BroadcastChannel 監聽，此處不需額外建立定時器。
    } else {
      // 大廳玩家列表輪詢 (5秒)
      fetchOnlinePlayers();
      pollingInterval.current = setInterval(() => {
        fetchOnlinePlayers();
      }, 5000);
    }

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [battleId, sentInvitation, player.id]);

  useEffect(() => {
    battleIdRef.current = battleId;
  }, [battleId]);

  useEffect(() => {
    battleStateRef.current = battleState;
  }, [battleState]);

  useEffect(() => {
    return () => {
      const currentBattleId = battleIdRef.current;
      const currentBattleState = battleStateRef.current;
      if (currentBattleId && currentBattleState && currentBattleState.status === 'active') {
        void ApiService.abandonBattle(currentBattleId, player.id).catch(err => {
          console.error('Abandon battle failed during unmount:', err);
        });
      }
    };
  }, [player.id]);

  // 當發送邀請狀態改變時，通知 App 元件，防止 App 輪詢搶佔狀態或阻擋邀請廣播
  useEffect(() => {
    if (onSentInvitationChange) {
      onSentInvitationChange(sentInvitation);
    }
  }, [sentInvitation, onSentInvitationChange]);

  // 1.2. 廣播監聽器
  useEffect(() => {
    const unsubscribe = registerBroadcastListener((data) => {
      if (getApiMode() === 'local') {
        if (data.type === 'INVITE_ACCEPTED' && String(data.sender_id || '').toLowerCase() === String(player.id || '').toLowerCase()) {
          // 安全檢查：只要當前邀請匹配，或者與最近一次發送的邀請 ID 匹配即可
          const isMatch = (sentInvitation && sentInvitation.id === data.invitation_id) ||
            (lastSentInvitationIdRef.current === data.invitation_id);
          if (!isMatch) {
            return;
          }
          setIsOpponentAccepted(true);
          setTimeout(() => {
            setSentInvitation(null);
            setIsOpponentAccepted(false);
            startBattle(data.battle_id);
          }, 1500);
        } else if (data.type === 'INVITE_REJECTED' && String(data.sender_id || '').toLowerCase() === String(player.id || '').toLowerCase()) {
          setAlertMessage('對方婉拒了你的切磋邀請。');
          setSentInvitation(null);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [player.id, sentInvitation]);

  // 1.5. 每秒更新剩餘時間，與對戰 start_time 精準同步
  useEffect(() => {
    let timer = null;
    if (battleState && battleState.status === 'active' && battleState.start_time) {
      const updateTime = () => {
        const elapsed = Date.now() - Number(battleState.start_time);
        const remaining = Math.max(0, 180 - Math.floor(elapsed / 1000));
        setTimeLeft(remaining);
      };

      updateTime(); // 立即計算一次
      timer = setInterval(updateTime, 1000);
    } else if (battleState && battleState.status === 'ended') {
      setTimeLeft(0);
    } else {
      setTimeLeft(180);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [battleState]);

  // 發送的切磋邀請 30 秒考慮時間倒數計時
  useEffect(() => {
    let timer = null;
    if (sentInvitation) {
      setSentInviteTimeLeft(30);
      timer = setInterval(() => {
        setSentInviteTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setSentInvitation(null);
            setAlertMessage('切磋邀請已超時，對方未能在考慮時間內回應。');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSentInviteTimeLeft(30);
    }
    return () => clearInterval(timer);
  }, [sentInvitation]);

  // 2. 獲取在線玩家
  const fetchOnlinePlayers = async () => {
    if (battleId) return;
    setLobbyLoading(true);
    try {
      const res = await ApiService.getOnlinePlayers(player.id);
      if (res.success) {
        setOnlinePlayers(res.online_players || []);
      }
    } catch (err) {
      console.error('Lobby error:', err);
    } finally {
      setLobbyLoading(false);
    }
  };

  // 3. 發送邀請與雲端輪詢邀請狀態
  const handleInvitePlayer = async (targetPlayer) => {
    setError('');
    setLobbyLoading(true);
    try {
      const res = await ApiService.invitePlayer(player.id, targetPlayer.id);
      if (res.success) {
        setSentInvitation({
          id: res.invitation_id,
          receiver_id: targetPlayer.id,
          receiver_name: targetPlayer.name,
          time: Date.now()
        });
        lastSentInvitationIdRef.current = res.invitation_id;
      }
    } catch (err) {
      setError(err.message || '發送邀請失敗');
    } finally {
      setLobbyLoading(false);
    }
  };

  // 3.5. 召回邀請
  const handleCancelInvite = async () => {
    if (sentInvitation) {
      const invId = sentInvitation.id;
      const rxId = sentInvitation.receiver_id;
      setSentInvitation(null);
      lastSentInvitationIdRef.current = null;
      try {
        if (getApiMode() === 'local') {
          postLocalBroadcast({
            type: 'INVITE_CANCELLED',
            invitation_id: invId,
            receiver_id: rxId
          });
        } else {
          await ApiService.respondInvitation(player.id, invId, false);
        }
      } catch (err) {
        console.error('Cancel invitation failed:', err);
      }
    }
  };

  // 4. 啟動對戰
  const resetBattleSession = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    const shouldAbandon = battleId && (!battleState || battleState.status === 'active');
    if (shouldAbandon) {
      void ApiService.abandonBattle(battleId, player.id).catch(err => {
        console.error('Abandon battle failed:', err);
      });
    }
    localStorage.removeItem('sa_active_battle_id');
    if (onClearBattleId) onClearBattleId();

    setBattleId(null);
    setBattleState(null);
    setSelectedCardIds([]);
    setUsedCardIds([]);
    setActionSubmitted(false);
    setLocalRoundNumber(1);
    setShowReveal(false);
    setShowRoundBanner(false);
    setRoundBannerNum(1);
    setRoundTimeLeft(15);
    setTimeLeft(180);
    setShakingPlayer(null);
    setActiveCardDetail(null);
    statsUpdatedRef.current = false;
    prevHpRef.current = { p1: null, p2: null };
    animatingRoundRef.current = null;
  };

  const startBattle = (id) => {
    localStorage.setItem('sa_active_battle_id', id);
    if (onStartBattle) {
      onStartBattle(id);
    }
    prevHpRef.current = { p1: null, p2: null };
    animatingRoundRef.current = null;
    setBattleId(id);
    setBattleState(null);
    setSelectedCardIds([]);
    setUsedCardIds([]);
    setActionSubmitted(false);
    setLocalRoundNumber(1);
    setShowReveal(false);
    setShowRoundBanner(false);
    setRoundBannerNum(1);
    setRoundTimeLeft(15);
    setShakingPlayer(null);
    setActiveCardDetail(null);
    statsUpdatedRef.current = false;
  };

  // 5. 獲取對戰狀態 (進行回合結算判定)
  const fetchBattleState = async (id) => {
    try {
      const res = await ApiService.getBattleState(id, player.id);
      if (res.success && res.battle) {
        const nextState = res.battle;

        if (nextState.status === 'abandoned') {
          resetBattleSession();
          return;
        }

        if (prevHpRef.current.p1 !== null && prevHpRef.current.p2 !== null) {
          if (nextState.p1_hp < prevHpRef.current.p1) {
            triggerShake('p1');
          }
          if (nextState.p2_hp < prevHpRef.current.p2) {
            triggerShake('p2');
          }
        }
        prevHpRef.current = { p1: nextState.p1_hp, p2: nextState.p2_hp };

        // 判定回合更新與動畫播放
        if (animatingRoundRef.current !== nextState.round_number) {
          const prevAnimRound = animatingRoundRef.current;
          animatingRoundRef.current = nextState.round_number;

          if (prevAnimRound === null) {
            // 第一次載入，播當前回合特效
            setLocalRoundNumber(nextState.round_number);
            setRoundBannerNum(nextState.round_number);
            setShowRoundBanner(true);
            setTimeout(() => {
              setShowRoundBanner(false);
              setRoundTimeLeft(15);
            }, 1500);
          } else {
            // 回合遞增，播 Reveal 動畫
            setShowReveal(true);
            setTimeout(() => {
              setShowReveal(false);
              if (nextState.status === 'active') {
                setRoundBannerNum(nextState.round_number);
                setShowRoundBanner(true);
                setTimeout(() => {
                  setShowRoundBanner(false);
                  setRoundTimeLeft(15);
                }, 1500);
              }
              setLocalRoundNumber(nextState.round_number);
              setSelectedCardIds([]);
              setActionSubmitted(false);
            }, 4000);
          }
        }

        setBattleState(nextState);

        const myRole = String(player.id || '').toLowerCase() === String(nextState.p1_id || '').toLowerCase() ? 'p1' : 'p2';
        const isWaiting = myRole === 'p1' ? (nextState.p1_action === 'waiting') : (nextState.p2_action === 'waiting');
        if (isWaiting && animatingRoundRef.current === nextState.round_number) {
          setActionSubmitted(false);
        }

        if (nextState.status === 'ended') {
          clearInterval(pollingInterval.current);
          syncUserExp();

          // 戰績結算統計
          if (!statsUpdatedRef.current) {
            statsUpdatedRef.current = true;
            setStats(prev => {
              const isWinner = String(nextState.winner_id || '').toLowerCase() === String(player.id || '').toLowerCase();
              const isDraw = nextState.winner_id === 'DRAW';
              const newStats = {
                total: prev.total + 1,
                wins: prev.wins + (isWinner ? 1 : 0),
                losses: prev.losses + (!isWinner && !isDraw ? 1 : 0)
              };
              localStorage.setItem(`tcm_stats_${player.id}`, JSON.stringify(newStats));
              return newStats;
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerShake = (target) => {
    setShakingPlayer(target);
    setTimeout(() => setShakingPlayer(null), 600);
  };

  const syncUserExp = async () => {
    try {
      const res = await ApiService.getPlayerData(player.id);
      if (res.success) {
        onPlayerUpdate(res.player);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 6. 提交出牌
  const handleSubmitAction = async () => {
    if (selectedCardIds.length === 0 || actionSubmitted || !battleId) return;
    setActionSubmitted(true);
    try {
      const actionStr = selectedCardIds.join(',');
      const res = await ApiService.submitBattleAction(battleId, player.id, actionStr);
      if (res.success) {
        setUsedCardIds(prev => [...prev, ...selectedCardIds]);
        setBattleState(res.battle);
      }
    } catch (err) {
      setError(err.message || '技能提交失敗');
      setActionSubmitted(false);
    }
  };

  // 超時自動提交空牌
  const handleAutoSubmitEmpty = async () => {
    if (actionSubmitted || !battleId) return;
    setActionSubmitted(true);
    try {
      const res = await ApiService.submitBattleAction(battleId, player.id, "");
      if (res.success) {
        setBattleState(res.battle);
      }
    } catch (err) {
      console.error('Auto submit empty failed:', err);
      setActionSubmitted(false);
    }
  };

  // 15 秒回合倒計時 (與 start_time 保持精準同步)
  useEffect(() => {
    let timer = null;
    if (battleId && battleState && battleState.status === 'active' && !showReveal && !showRoundBanner) {
      if (isMyTurn && !actionSubmitted) {
        const updateTimer = () => {
          const elapsed = Date.now() - Number(battleState.start_time);
          const remaining = Math.max(0, 15 - Math.floor(elapsed / 1000));
          setRoundTimeLeft(remaining);

          if (remaining <= 0) {
            if (timer) clearInterval(timer);
            handleAutoSubmitEmpty();
          }
        };

        updateTimer();
        timer = setInterval(updateTimer, 1000);
      } else {
        setRoundTimeLeft(15);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [battleId, battleState, showReveal, showRoundBanner, isMyTurn, actionSubmitted]);

  // 選擇卡牌處理 (最多2張，點選第3張會顯示錯誤提示並擋下)
  const handleSelectCard = (cardId) => {
    if (actionSubmitted) return;
    setSelectedCardIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else {
        if (prev.length >= 2) {
          setError("最多只能選擇兩張卡牌！");
          setTimeout(() => setError(""), 2000);
          return prev;
        } else {
          return [...prev, cardId];
        }
      }
    });
  };

  const handleExitBattle = () => {
    const shouldAbandon = battleId && (!battleState || battleState.status === 'active');
    if (shouldAbandon) {
      void ApiService.abandonBattle(battleId, player.id).catch(err => {
        console.error('Abandon battle failed:', err);
      });
    }
    resetBattleSession();
    if (onClearBattleId) onClearBattleId();
    clearInterval(pollingInterval.current);
    setBattleId(null);
    setBattleState(null);
    setSelectedCardIds([]);
    setUsedCardIds([]);
    setActionSubmitted(false);
    setLocalRoundNumber(1);
    setShowReveal(false);
    setShowRoundBanner(false);
    statsUpdatedRef.current = false; // 重置統計狀態
    prevHpRef.current = { p1: null, p2: null };

    fetchOnlinePlayers();
    pollingInterval.current = setInterval(() => {
      fetchOnlinePlayers();
    }, 5000);
  };

  // 轉換戰鬥日誌名詞為中醫古風
  const formatTcmLog = (logText) => {
    if (typeof logText !== 'string') return '';
    return logText
      .replace(/生命值/g, '營血')
      .replace(/生命傷害/g, '衛氣營血受損')
      .replace(/生命/g, '營血')
      .replace(/防護力/g, '衛氣強度')
      .replace(/防禦/g, '衛氣')
      .replace(/攻擊力/g, '內功強度')
      .replace(/攻擊/g, '內功')
      .replace(/氣血/g, '營血')
      .replace(/藥力/g, '內功')
      .replace(/經絡/g, '衛氣')
      .replace(/禦力/g, '衛氣')
      .replace(/出牌/g, '點刺/投藥')
      .replace(/對手/g, '切磋同道')
      .replace(/傷害/g, '受損')
      .replace(/物理/g, '穴位刺激')
      .replace(/技能/g, '方劑藥性');
  };

  // 前端計算單回合傷害與治療
  const getRoundCalculation = (role) => {
    if (!battleState || (!battleState.p1_last_action && !battleState.p2_last_action)) return null;

    const isP1Role = role === 'p1';
    const p1CardIds = String(battleState.p1_last_action || '').split(',').filter(Boolean);
    const p2CardIds = String(battleState.p2_last_action || '').split(',').filter(Boolean);

    const p1Cards = p1CardIds.map(cid => CARDS[cid]).filter(Boolean);
    const p2Cards = p2CardIds.map(cid => CARDS[cid]).filter(Boolean);

    const p1Stats = { atk: battleState.p1_atk, def: battleState.p1_def };
    const p2Stats = { atk: battleState.p2_atk, def: battleState.p2_def };

    const effects = calculateRoundEffects(p1Cards, p2Cards, p1Stats, p2Stats);

    const p1RoundAtk = Math.max(0, battleState.p1_atk + effects.p1AtkMod);
    const p1RoundDef = Math.max(0, battleState.p1_def + effects.p1DefMod);
    const p2RoundAtk = Math.max(0, battleState.p2_atk + effects.p2AtkMod);
    const p2RoundDef = Math.max(0, battleState.p2_def + effects.p2DefMod);

    const physDmgToP1 = Math.max(0, p2RoundAtk - p1RoundDef);
    const physDmgToP2 = Math.max(0, p1RoundAtk - p2RoundDef);

    if (isP1Role) {
      return {
        physDmg: physDmgToP1,
        skillDmg: effects.p1HpMod < 0 ? Math.abs(effects.p1HpMod) : 0,
        heal: effects.p1HpMod > 0 ? effects.p1HpMod : 0
      };
    } else {
      return {
        physDmg: physDmgToP2,
        skillDmg: effects.p2HpMod < 0 ? Math.abs(effects.p2HpMod) : 0,
        heal: effects.p2HpMod > 0 ? effects.p2HpMod : 0
      };
    }
  };

  const myCalc = (showReveal && meObj) ? getRoundCalculation(meObj.role) : null;
  const oppCalc = (showReveal && oppObj) ? getRoundCalculation(oppObj.role) : null;

  const detailRarity = activeCardDetail ? (RARITY_COLORS[activeCardDetail.rarity] || RARITY_COLORS["綠色"]) : null;
  const isWinner = (battleState && battleState.winner_id) ? (String(battleState.winner_id).toLowerCase() === String(player.id || '').toLowerCase()) : false;
  const isDraw = battleState ? battleState.winner_id === 'DRAW' : false;

  // 1. 卡片說明彈窗
  const renderCardDetailPortal = () => {
    if (!activeCardDetail) return null;
    return createPortal(
      <div className="tcm-modal-overlay" onClick={() => setActiveCardDetail(null)}>
        <div className="tcm-card-detail-container" onClick={e => e.stopPropagation()}>
          <h3 className={`tcm-card-detail-title ${detailRarity.text}`}>
            {activeCardDetail.name}
          </h3>

          {activeCardDetail.image_url && (
            <div className="tcm-card-detail-img-wrapper">
              <img src={activeCardDetail.image_url} alt={activeCardDetail.name} />
            </div>
          )}

          <div className="tcm-card-detail-desc">
            {activeCardDetail.description}
          </div>

          <div className="tcm-card-detail-grid">
            <div className="tcm-card-detail-item">
              <span className="tcm-card-detail-label">類型</span>
              <span className="tcm-card-detail-value">{activeCardDetail.type === 'equipment' ? '裝備加護' : '方劑技能'}</span>
            </div>
            <div className="tcm-card-detail-item">
              <span className="tcm-card-detail-label">稀有度</span>
              <span className={`tcm-card-detail-value ${detailRarity.text}`}>{activeCardDetail.rarity || '綠色'}</span>
            </div>
            {activeCardDetail.element && (
              <div className="tcm-card-detail-item">
                <span className="tcm-card-detail-label">屬性</span>
                <span className={`tcm-card-detail-value ${activeCardDetail.element === '火' ? 'text-orange-400' :
                  activeCardDetail.element === '水' ? 'text-blue-400' :
                    activeCardDetail.element === '木' ? 'text-emerald-400' :
                      activeCardDetail.element === '金' ? 'text-yellow-300' :
                        activeCardDetail.element === '土' ? 'text-amber-500' : 'text-gray-400'
                  }`}>{activeCardDetail.element}</span>
              </div>
            )}
            <div className="tcm-card-detail-item">
              <span className="tcm-card-detail-label">作用對象</span>
              <span className="tcm-card-detail-value">{activeCardDetail.target === 'self' ? '自身' : activeCardDetail.target === 'opponent' ? '對手' : '調和'}</span>
            </div>
            {(activeCardDetail.atk_mod !== 0) && (
              <div className="tcm-card-detail-item">
                <span className="tcm-card-detail-label">初始內功</span>
                <span className="tcm-card-detail-value text-emerald-400">+{activeCardDetail.atk_mod}</span>
              </div>
            )}
            {(activeCardDetail.def_mod !== 0) && (
              <div className="tcm-card-detail-item">
                <span className="tcm-card-detail-label">初始衛氣</span>
                <span className="tcm-card-detail-value text-emerald-400">+{activeCardDetail.def_mod}</span>
              </div>
            )}
            {activeCardDetail.type === 'skill' && (() => {
              const conds = [];
              if (activeCardDetail.self_atk) conds.push(`自身現存內功 ${activeCardDetail.self_atk}`);
              if (activeCardDetail.self_def) conds.push(`自身現存衛氣 ${activeCardDetail.self_def}`);
              if (activeCardDetail.ops_atk) conds.push(`同道現存內功 ${activeCardDetail.ops_atk}`);
              if (activeCardDetail.ops_def) conds.push(`同道現存衛氣 ${activeCardDetail.ops_def}`);
              if (activeCardDetail.self_othr_atk) conds.push(`另方內功變動 ${activeCardDetail.self_othr_atk}`);
              if (activeCardDetail.self_othr_def) conds.push(`另方衛氣變動 ${activeCardDetail.self_othr_def}`);
              if (activeCardDetail.self_othr_ele) conds.push(`另方五行屬性 ${activeCardDetail.self_othr_ele}`);
              if (activeCardDetail.ops_any_atk) conds.push(`同道任一內功變動 ${activeCardDetail.ops_any_atk}`);
              if (activeCardDetail.ops_any_def) conds.push(`同道任一衛氣變動 ${activeCardDetail.ops_any_def}`);
              if (activeCardDetail.ops_any_ele) conds.push(`同道任一五行屬性 ${activeCardDetail.ops_any_ele}`);

              if (conds.length === 0) return (
                <div className="tcm-card-detail-item tcm-card-detail-conditions">
                  <span className="tcm-card-detail-label">觸發條件</span>
                  <span className="tcm-card-detail-value text-gray-400">無條件限制</span>
                </div>
              );

              return (
                <div className="tcm-card-detail-item tcm-card-detail-conditions">
                  <span className="tcm-card-detail-label">觸發條件 (需全部滿足)</span>
                  <ul className="list-disc pl-3 text-[10px] text-amber-200 font-serif space-y-0.5" style={{ margin: 0 }}>
                    {conds.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              );
            })()}
            {activeCardDetail.type === 'skill' && (() => {
              const effectsList = [];
              if (activeCardDetail.atk_aft) effectsList.push(`內功強度: ${activeCardDetail.atk_aft > 0 ? '+' : ''}${activeCardDetail.atk_aft}`);
              if (activeCardDetail.def_aft) effectsList.push(`衛氣強度: ${activeCardDetail.def_aft > 0 ? '+' : ''}${activeCardDetail.def_aft}`);
              if (activeCardDetail.hp_aft) effectsList.push(`營血調養: ${activeCardDetail.hp_aft > 0 ? '+' : ''}${activeCardDetail.hp_aft}`);

              if (effectsList.length === 0) return null;
              return (
                <div className="tcm-card-detail-item tcm-card-detail-effects">
                  <span className="tcm-card-detail-label">觸發後效果</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px] font-serif">
                    {effectsList.map((ef, i) => (
                      <div key={i} className={ef.includes('-') ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        • {ef}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="tcm-card-detail-close-tip">
            (點擊任意空白處即可關閉)
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 2. 最終對戰結算彈窗
  const renderBattleEndedPortal = () => {
    if (!battleState || battleState.status !== 'ended') return null;
    return createPortal(
      <div className="tcm-modal-overlay animate-fade-in">
        <div className={`w-full max-w-sm glass-panel p-6 space-y-6 text-center border-2 transition duration-300 ${isDraw ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
          isWinner
            ? 'border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.4)] bg-gradient-to-b from-yellow-955/20 to-zinc-900/95'
            : 'border-zinc-800 shadow-[0_0_15px_rgba(0,0,0,0.6)] bg-zinc-950/95'
          }`}>
          <div className="text-center space-y-3">
            <div className={`inline-flex p-4 rounded-full mx-auto border transition duration-300 ${isDraw ? 'bg-amber-955/40 border-amber-500/30 text-amber-500' :
              isWinner
                ? 'bg-yellow-955/60 border-yellow-400 text-yellow-400 animate-bounce'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500'
              }`}>
              <Trophy size={40} />
            </div>

            <h3 className={`text-xl font-black font-serif tracking-wider ${isDraw ? 'text-amber-400' :
              isWinner ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500' : 'text-gray-400'
              }`}>
              {isDraw ? '☯️ 雙方功力相當，不分軒輊！' :
                isWinner ? '🎉 功力深厚，本局切磋勝出！' : '⚔️ 內功略遜一籌！下回再試。'}
            </h3>

            <div className="p-3 bg-black/40 rounded-lg border border-amber-955/20 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-gray-500">
                <span>切磋結果：</span>
                <span className={isWinner ? 'text-yellow-400 font-bold' : isDraw ? 'text-amber-400' : 'text-gray-400'}>
                  {isDraw ? '和局 (DRAW)' : isWinner ? '勝出 (VICTORY)' : '敗北 (DEFEAT)'}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>勝出同道：</span>
                <span className="text-gray-300 font-bold">{battleState.winner_id}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>最終營血：</span>
                <span className="text-gray-400">
                  我方 {meObj ? meObj.hp : 0} | 敵方 {oppObj ? oppObj.hp : 0}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 leading-relaxed font-serif">
              切磋結束，修為獎勵已注入你的靈獸經脈中！
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-battle-exit"
              onClick={handleExitBattle}
              className="btn-neon w-full py-2.5 text-xs font-bold transition transform active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            >
              返回切磋大廳
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 3. 回合結算展示彈窗
  const renderRoundRevealPortal = () => {
    if (!showReveal) return null;
    return createPortal(
      <div className="tcm-modal-overlay animate-fade-in">
        <div className="glass-panel glass-panel-neon text-center border border-amber-500/30 animate-scale-up" style={{ width: '290px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
          {/* 1. 標題區 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h3 className="text-amber-500 font-mono font-bold flex items-center justify-center gap-1" style={{ fontSize: '11px', margin: 0, padding: 0 }}>
              ☯️ 回合結算 ☯️
            </h3>
            <p className="text-gray-500 font-serif" style={{ fontSize: '8px', margin: 0, padding: 0 }}>
              回合 {Math.min(5, battleState.round_number - 1)} 功力交鋒展示
            </p>
          </div>

          {/* 2. 對手出的卡牌 (中上部) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span className="text-rose-400 font-bold font-serif" style={{ fontSize: '9px' }}>
              同道 ({oppObj ? oppObj.id : ''}) 技能
            </span>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {(() => {
                const lastActionStr = battleState ? (!isP1 ? battleState.p1_last_action : battleState.p2_last_action) : "";
                const cardIds = lastActionStr ? String(lastActionStr).split(',').filter(Boolean) : [];
                if (cardIds.length === 0) return <span className="text-gray-500 font-serif" style={{ fontSize: '9px' }}>空過 / 未出牌</span>;
                return cardIds.map((cid, i) => {
                  const card = CARDS[cid];
                  if (!card) return <span key={i} className="text-gray-600" style={{ fontSize: '9px' }}>無效</span>;
                  const cardRarity = RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"];
                  return (
                    <div
                      key={i}
                      className={`border rounded flex flex-col justify-between text-left transition duration-200 overflow-hidden relative shadow bg-zinc-900/95 ${cardRarity?.border || ''} ${cardRarity?.shadow || ''}`}
                      style={{ width: '56px', height: '66px', boxSizing: 'border-box', padding: '3px', aspectRatio: '0.85' }}
                    >
                      <div className="w-full text-center mb-0.5 leading-none">
                        <span className={`font-black font-serif truncate block ${cardRarity?.text || ''}`} style={{ fontSize: '6px' }}>{card.name}</span>
                      </div>

                      <div className="rounded border border-amber-955/10 overflow-hidden relative" style={{ width: '100%', height: '36px' }}>
                        <img
                          src={convertGoogleDriveUrl(card.image_url) || "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&auto=format&fit=crop"}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* 3. 中部文字說明 */}
          <div className="bg-black/50 rounded border border-amber-955/10 text-center font-serif" style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {(() => {
              const myLastActionStr = battleState ? (isP1 ? battleState.p1_last_action : battleState.p2_last_action) : "";
              const myCardIds = myLastActionStr ? String(myLastActionStr).split(',').filter(Boolean) : [];
              const myCardNames = myCardIds.map(cid => CARDS[cid]?.name || '無效').join(' + ') || '空過/未出牌';

              const oppLastActionStr = battleState ? (!isP1 ? battleState.p1_last_action : battleState.p2_last_action) : "";
              const oppCardIds = oppLastActionStr ? String(oppLastActionStr).split(',').filter(Boolean) : [];
              const oppCardNames = oppCardIds.map(cid => CARDS[cid]?.name || '無效').join(' + ') || '空過/未出牌';

              return (
                <div className="text-gray-300 leading-normal" style={{ fontSize: '9px' }}>
                  <p style={{ margin: 0 }}>我方技能：<span className="text-emerald-400 font-bold">{myCardNames}</span></p>
                  <p style={{ margin: 0 }}>同道技能：<span className="text-rose-400 font-bold">{oppCardNames}</span></p>
                </div>
              );
            })()}
          </div>

          {/* 4. 自己出的卡牌 (中下部) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span className="text-emerald-400 font-bold font-serif" style={{ fontSize: '9px' }}>
              我方 技能
            </span>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {(() => {
                const lastActionStr = battleState ? (isP1 ? battleState.p1_last_action : battleState.p2_last_action) : "";
                const cardIds = lastActionStr ? String(lastActionStr).split(',').filter(Boolean) : [];
                if (cardIds.length === 0) return <span className="text-gray-500 font-serif" style={{ fontSize: '9px' }}>空過 / 未出牌</span>;
                return cardIds.map((cid, i) => {
                  const card = CARDS[cid];
                  if (!card) return <span key={i} className="text-gray-600" style={{ fontSize: '9px' }}>無效</span>;
                  const cardRarity = RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"];
                  return (
                    <div
                      key={i}
                      className={`border rounded flex flex-col justify-between text-left transition duration-200 overflow-hidden relative shadow bg-zinc-900/95 ${cardRarity?.border || ''} ${cardRarity?.shadow || ''}`}
                      style={{ width: '56px', height: '66px', boxSizing: 'border-box', padding: '3px', aspectRatio: '0.85' }}
                    >
                      <div className="w-full text-center mb-0.5 leading-none">
                        <span className={`font-black font-serif truncate block ${cardRarity?.text || ''}`} style={{ fontSize: '6px' }}>{card.name}</span>
                      </div>

                      <div className="rounded border border-amber-955/10 overflow-hidden relative" style={{ width: '100%', height: '36px' }}>
                        <img
                          src={convertGoogleDriveUrl(card.image_url) || "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=150&auto=format&fit=crop"}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* 5. 底部提示 */}
          <div className="text-amber-500/70 font-serif animate-pulse border-t border-amber-955/10" style={{ fontSize: '8px', paddingTop: '6px', margin: 0 }}>
            🔮 回合展示中，功力調和後自動推進下一回合...
          </div>
        </div>
      </div>,
      document.body
    );
  };

  try {
    return (
      <div className="w-full max-w-full space-y-4" style={{ boxSizing: 'border-box', overflowX: 'hidden' }}>

        {error && (
          <div className="p-3 bg-rose-955/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-center gap-2 animate-shake">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ======================= 大廳模式 (Lobby) ======================= */}
        {!battleId && (
          <div className="tcm-battle-lobby-container">

            {/* 1. 在線對手列表 */}
            <div className="glass-panel p-5 border-gray-800 space-y-3 border">
              <div className="flex justify-center items-center border-b border-amber-900/30 pb-3 gap-2">
                <h3 className="text-sm font-bold text-gray-300 flex items-center justify-center gap-1.5 font-serif">
                  <Users size={16} className="text-amber-500" />
                  在線同道
                </h3>

                <button
                  onClick={fetchOnlinePlayers}
                  className="tcm-battle-refresh-btn"
                  title="更新上線情況"
                >
                  <RefreshCw size={12} className={lobbyLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="tcm-battle-opponents-list">
                {onlinePlayers.length === 0 ? (
                  <div className="py-20 text-center text-gray-500 text-xs font-serif leading-relaxed">
                    目前大廳內無其他在線同道
                    <br />
                    請更新上線情況以發起挑戰
                  </div>
                ) : (
                  onlinePlayers.map(p => {
                    const isInvitingThis = sentInvitation && sentInvitation.receiver_id === p.id;
                    return (
                      <div
                        key={p.id}
                        className="tcm-battle-opponent-row"
                      >
                        <div className="tcm-battle-opponent-name">
                          {p.name}
                        </div>

                        <div className="tcm-battle-opponent-level">
                          LV {p.level}
                        </div>

                        <div className="tcm-battle-opponent-action">
                          {isInvitingThis ? (
                            <button
                              onClick={handleCancelInvite}
                              className="tcm-action-btn unequip-action tcm-battle-btn-compact"
                            >
                              召回 ({sentInviteTimeLeft}s)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleInvitePlayer(p)}
                              disabled={sentInvitation !== null}
                              className="btn-neon tcm-battle-btn-compact"
                            >
                              <Swords size={11} />
                              發起挑戰
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. 戰績區塊 */}
            <div className="glass-panel p-5 border-gray-800 space-y-3 border" style={{ marginTop: '20px' }}>
              <h3 className="text-sm font-bold text-gray-300 flex items-center justify-center gap-1.5 border-b border-amber-900/30 pb-3 font-serif">
                <Trophy size={16} className="text-amber-500" />
                修煉切磋戰績
              </h3>

              {/* 圓圈圈 + 數字排版 */}
              <div className="tcm-battle-stat-circles-container">
                <div className="tcm-battle-stat-circle total">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">切磋場數</span>
                </div>
                <div className="tcm-battle-stat-circle wins">
                  <span className="stat-value">{stats.wins}</span>
                  <span className="stat-label">功力勝出</span>
                </div>
                <div className="tcm-battle-stat-circle losses">
                  <span className="stat-value">{stats.losses}</span>
                  <span className="stat-label">內功略遜</span>
                </div>
              </div>

              {/* 進度百分條 */}
              {(() => {
                const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
                return (
                  <div className="tcm-battle-winrate-container">
                    <div className="winrate-header">
                      <span>當前切磋勝率</span>
                      <span className="winrate-val">{winRate}%</span>
                    </div>
                    <div className="winrate-track">
                      <div className="winrate-fill" style={{ width: `${winRate}%` }}></div>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* ======================= 載入對戰中 (Loading Battle) ================== */}
        {battleId && !battleState && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                <RefreshCw size={16} className="animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-gray-300 font-serif">切磋場地準備中，請稍後...</p>
              <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Battlefield Preparing...</p>
            </div>
          </div>
        )}

        {/* ======================= 戰鬥模式 (In Battle) ================== */}
        {battleId && battleState && (() => {
          const activeDeck = (player.deck || []).filter(Boolean);

          const renderCard = (index) => {
            const cardId = activeDeck[index];

            // 空白槽：直接挪用技能卡槽的空槽樣式，保留一致的0.85比例與外觀
            if (!cardId) {
              return (
                <div
                  key={`empty-${index}`}
                  className="tcm-skill-slot empty-slot cursor-default"
                  style={{ aspectRatio: '0.85' }}
                >
                  <span className="tcm-skill-slot-index z-10">{index + 1}</span>
                </div>
              );
            }

            const card = CARDS[cardId];
            if (!card) return null;

            const isUsed = usedCardIds.includes(cardId) ||
              (usedCardIds.filter(id => id === cardId).length > (player.deck.filter(id => id === cardId).length - 1));

            const isSelected = selectedCardIds.includes(cardId);
            const rarityStyle = RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"];

            return (
              <button
                key={`${cardId}-${index}`}
                disabled={actionSubmitted || !isMyTurn || isUsed}
                onClick={() => handleSelectCard(cardId)}
                className={`tcm-skill-slot ${isSelected ? 'active' : ''} ${rarityStyle.border} transition duration-200 overflow-hidden relative shadow bg-zinc-900/90 active:scale-95 disabled:active:scale-100`}
                style={{
                  aspectRatio: '0.85',
                  pointerEvents: isUsed ? 'none' : 'auto',
                  filter: isUsed ? 'grayscale(1)' : 'none',
                  opacity: isUsed ? 0.45 : 1
                }}
              >
                {/* 圖片鋪滿與 Fallback 大字 */}
                {card.image_url ? (
                  <img
                    src={convertGoogleDriveUrl(card.image_url)}
                    alt={card.name}
                    className="absolute inset-0 w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className={`tcm-skill-slot-name ${rarityStyle.text}`}>
                    {card.name}
                  </span>
                )}

                <span className="tcm-skill-slot-index z-10">{index + 1}</span>

                {/* 右上角 Information 標示 - 明顯發光金邊版 */}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveCardDetail(card);
                  }}
                  className="absolute top-1 right-1 z-20 p-0.5 rounded-full bg-black/95 text-amber-400 hover:text-amber-200 hover:bg-black transition cursor-pointer flex items-center justify-center border border-amber-500/40 shadow-[0_0_4px_rgba(245,158,11,0.6)]"
                  title="查看效果"
                >
                  <Info size={9} />
                </span>
              </button>
            );
          };

          return (
            <div className="w-full flex flex-col mx-auto" style={{ boxSizing: 'border-box', padding: '0', gap: '4px', maxWidth: '100%' }}>

              {/* 0. 房號 */}
              <div className="flex flex-row justify-between items-center w-full px-2 py-0.5 text-[9px] border-b border-amber-955/20 text-gray-500 font-mono">
                <span>切磋房號: {battleState.battle_id.replace('BAT_', '')}</span>
              </div>

              {/* 1. 對手區 - 包裹 tcm-battle-section */}
              <div className="tcm-battle-section w-full">
                <div className="text-[8px] text-amber-500 font-bold font-serif leading-none pb-0.5 border-b border-amber-900/20" style={{ margin: '0 0 2px 0' }}>
                  【 同道切磋狀態 】
                </div>
                <div
                  className={`w-full relative space-y-0.5 transition duration-150 ${shakingPlayer === oppObj.role ? 'animate-shake bg-red-950/15' : ''
                    }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="flex justify-between items-center text-[9px] text-red-400 font-bold font-serif leading-none pt-0.5">
                    <span>同道衛氣</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 truncate max-w-[80px]" title={oppObj.id}>{oppObj.id}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${oppObj.action !== 'waiting' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                        }`} title={oppObj.action !== 'waiting' ? '已選擇技能' : '選擇中'} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-mono font-bold text-red-400 leading-none pt-0.5">
                    <span>營血</span>
                    <span>{oppObj.hp}/{oppObj.maxHp}</span>
                  </div>

                  {/* 營血條 */}
                  <div className="hp-bar-container" style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px' }}>
                    <div
                      className="hp-bar-fill bg-gradient-to-r from-red-600 to-amber-700 animate-pulse"
                      style={{ width: `${Math.max(0, (oppObj.hp / oppObj.maxHp) * 100)}%`, borderRadius: '3px' }}
                    ></div>
                  </div>

                  {/* 屬性單行顯示 */}
                  <div className="flex justify-between text-[9px] font-mono leading-none pt-1 text-gray-400">
                    <span>內功: <span className="text-amber-400 font-bold">{oppObj.atk}</span></span>
                    <span>衛氣: <span className="text-amber-400 font-bold">{oppObj.def}</span></span>
                  </div>

                  {(() => {
                    const calc = getRoundCalculation(oppObj.role);
                    if (!calc) return null;
                    const netChange = calc.heal - (calc.physDmg + calc.skillDmg);
                    return (
                      <div className="text-[8px] font-serif flex gap-1 justify-between text-gray-400 border-t border-amber-955/10 pt-1 leading-none">
                        <span>損: <span className="text-rose-400">-{calc.physDmg + calc.skillDmg}</span></span>
                        <span>療: <span className="text-emerald-400 font-bold">+{calc.heal}</span></span>
                        <span className={netChange >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          ({netChange >= 0 ? '+' : ''}{netChange})
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 2. 計時區 - 包裹 tcm-battle-section */}
              <div className="tcm-battle-section w-full">
                <div className="flex flex-row justify-between items-center w-full text-[9px] text-gray-400 font-serif leading-none" style={{ boxSizing: 'border-box' }}>
                  <span>出牌輪數: {showReveal ? Math.min(5, battleState.round_number - 1) : Math.min(5, battleState.round_number)} / 5</span>
                  <div className="flex items-center gap-1 font-mono text-[9px] text-amber-400">
                    <Hourglass size={10} className={((isMyTurn && roundTimeLeft <= 5) || showReveal) ? "animate-bounce text-rose-500" : "animate-spin text-amber-500"} />
                    <span>
                      {showReveal ? "回合展示中" :
                        !isMyTurn ? "等待同道選擇..." :
                          `剩餘:${roundTimeLeft}秒`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. 個人區 - 包裹 tcm-battle-section */}
              <div className="tcm-battle-section w-full">
                <div className="text-[8px] text-amber-500 font-bold font-serif leading-none pb-0.5 border-b border-amber-900/20" style={{ margin: '0 0 2px 0' }}>
                  【 吾身切磋狀態 】
                </div>
                <div
                  className={`w-full relative space-y-0.5 transition duration-150 ${shakingPlayer === meObj.role ? 'animate-shake bg-red-950/15' : ''
                    }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="flex justify-between items-center text-[9px] text-amber-500 font-bold font-serif leading-none pt-0.5">
                    <span>吾身衛氣</span>
                    <span className="text-gray-400 truncate max-w-[80px]" title={meObj.id}>{meObj.id}</span>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-mono font-bold text-amber-400 leading-none pt-0.5">
                    <span>營血</span>
                    <span>{meObj.hp}/{meObj.maxHp}</span>
                  </div>

                  {/* 營血條 */}
                  <div className="hp-bar-container" style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px' }}>
                    <div
                      className="hp-bar-fill animate-pulse"
                      style={{ width: `${Math.max(0, (meObj.hp / meObj.maxHp) * 100)}%`, borderRadius: '3px' }}
                    ></div>
                  </div>

                  {/* 屬性單行顯示 - 純文字排版，不加背景容器 */}
                  <div className="flex justify-between text-[9px] font-mono leading-none pt-0.5 text-gray-400">
                    <span>內功: <span className="text-amber-400 font-bold">{meObj.atk}</span></span>
                    <span>衛氣: <span className="text-amber-400 font-bold">{meObj.def}</span></span>
                  </div>

                  {(() => {
                    const calc = getRoundCalculation(meObj.role);
                    if (!calc) return null;
                    const netChange = calc.heal - (calc.physDmg + calc.skillDmg);
                    return (
                      <div className="text-[8px] font-serif flex gap-1 justify-between text-gray-400 border-t border-amber-955/10 pt-1 leading-none">
                        <span>損: <span className="text-rose-400">-{calc.physDmg + calc.skillDmg}</span></span>
                        <span>療: <span className="text-emerald-400">+{calc.heal}</span></span>
                        <span className={netChange >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          ({netChange >= 0 ? '+' : ''}{netChange})
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 4. 出牌區 - 包裹 tcm-battle-section */}
              {battleState && battleState.status === 'active' && (
                <div
                  className="tcm-battle-section w-full transition-opacity duration-300"
                  style={{ opacity: showReveal ? 0.25 : 1, pointerEvents: showReveal ? 'none' : 'auto', boxSizing: 'border-box' }}
                >
                  <div className="text-[8px] text-amber-500 font-bold font-serif leading-none pb-0.5 border-b border-amber-900/20" style={{ margin: '0 0 3px 0' }}>
                    【 技能出牌區 】
                  </div>

                  <div className="w-full overflow-hidden" style={{ boxSizing: 'border-box' }}>
                    <div className="tcm-battle-cards-ring-grid">
                      {/* Row 1 */}
                      {renderCard(0)}
                      {renderCard(1)}
                      {renderCard(2)}
                      {renderCard(3)}

                      {/* Row 2 */}
                      {renderCard(4)}
                      <div className="tcm-battle-submit-btn-wrapper">
                        <button
                          id="btn-battle-submit"
                          disabled={selectedCardIds.length === 0 || actionSubmitted || !isMyTurn}
                          onClick={handleSubmitAction}
                          className="btn-neon w-full transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center text-center font-serif leading-none tcm-grid-button"
                          style={{ height: '36px', minHeight: '36px', fontSize: '9px', padding: '2px 4px' }}
                        >
                          {!isMyTurn ? '等候出牌' :
                            actionSubmitted ? '已選擇技能' :
                              `確認出牌 (${selectedCardIds.length}/2)`}
                        </button>
                      </div>
                      {renderCard(5)}

                      {/* Row 3 */}
                      {renderCard(6)}
                      {renderCard(7)}
                      {renderCard(8)}
                      {renderCard(9)}
                    </div>
                  </div>
                </div>
              )}



              {/* 回合特效 banner */}
              {showRoundBanner && createPortal(
                <div className="tcm-round-banner-overlay">
                  <div className="tcm-round-banner-text">
                    Round {roundBannerNum}
                  </div>
                </div>,
                document.body
              )}

              {renderCardDetailPortal()}
              {renderBattleEndedPortal()}
              {renderRoundRevealPortal()}

            </div>
          );
        })()}

        {/* ==================== 網頁內提醒對話框 ==================== */}
        {alertMessage && (
          <div className="tcm-floating-invite-overlay">
            <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 text-center animate-shake">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-rose-955/40 text-rose-400 border border-rose-500/20 animate-pulse mx-auto">
                  <AlertCircle size={24} className="shrink-0" />
                </div>
                <h3 className="text-lg font-bold text-gray-200 font-serif">培育空間提示</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-serif text-center">{alertMessage}</p>
              </div>
              <div className="pt-2">
                <button
                  id="btn-battle-alert-close"
                  onClick={() => setAlertMessage(null)}
                  className="btn-neon px-6 py-2 text-xs font-bold"
                >
                  知曉
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ==================== 彈窗：發出邀請狀態 (改為置中浮動視窗 + 模糊背景) ==================== */}
        {sentInvitation && !battleId && (
          <div className="tcm-floating-invite-overlay">
            <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 text-center">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-amber-955/40 text-amber-500 border border-amber-500/20 animate-pulse mx-auto">
                  <PlayCircle size={24} className="animate-spin text-amber-500" style={{ animationDuration: '3s' }} />
                </div>
                <h3 className="text-lg font-bold text-gray-200 font-serif">發出切磋邀請</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-serif text-center">
                  正在向同道 <span className="text-amber-400 font-bold">[ {sentInvitation.receiver_name} ]</span> 發起切磋中...
                  <br />
                  <span className="text-xs text-rose-400 font-bold mt-1 block">(等待回應剩餘時間：{sentInviteTimeLeft} 秒)</span>
                </p>
              </div>

              {isOpponentAccepted ? (
                <div className="text-xs text-emerald-400 font-bold font-serif animate-pulse pt-2">
                  對方已接受，正在進入切磋場地...
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    id="btn-cancel-invite"
                    onClick={handleCancelInvite}
                    className="btn-neon-decline px-6 py-2 text-xs font-bold"
                  >
                    召回邀請
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  } catch (err) {
    console.error("BattleTab render error:", err);
    return (
      <div className="p-6 bg-red-950/80 border border-red-500 text-red-200 rounded-xl space-y-2 max-w-md mx-auto my-10 font-mono text-center">
        <h3 className="font-bold text-sm">⚠️ 切磋畫面渲染出錯 (Render Error)</h3>
        <p className="text-xs text-red-400">{err.message}</p>
        <pre className="text-[10px] bg-black/40 p-3 rounded overflow-auto max-h-60 text-left">{err.stack}</pre>
        <button
          onClick={handleExitBattle}
          className="btn-outline border-red-500/40 text-red-300 py-1.5 px-4 rounded text-xs hover:bg-red-950 mt-2"
        >
          返回切磋大廳
        </button>
      </div>
    );
  }
}
