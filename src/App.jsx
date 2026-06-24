import { useState, useEffect, useRef } from 'react';
import { ApiService, registerBroadcastListener, postLocalBroadcast, getApiMode } from './services/api';
import { CARDS, RARITY_COLORS, detectRewardCards, convertGoogleDriveUrl, updateCardsFromSheets } from './services/cardData';
import PlayerHUD from './components/PlayerHUD';
import EquipTab from './components/EquipTab';
import SkillsTab from './components/SkillsTab';
import BattleTab from './components/BattleTab';
import InventoryTab from './components/InventoryTab';
import AdminPanel from './components/AdminPanel';
import GameAdminPanel from './components/GameAdminPanel';
import Login from './components/Login';
import { 
  Swords, Sparkles, Trophy, ShieldAlert, 
  LogOut, ShieldCheck, Settings2, Briefcase, BellRing, Leaf
} from 'lucide-react';

function getPendingClaimTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'claim') {
    return params.get('token');
  }
  return null;
}

function getPendingClaimCardIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'claim') {
    return params.get('card_id');
  }
  return null;
}

const TAB_TITLES = {
  inventory: '背包',
  equip: '裝備',
  skills: '技能',
  battle: '戰鬥',
  admin: '分藥面板',
  game_admin: '大掌櫃面板'
};

export default function App() {
  const [player, setPlayer] = useState(null);
  const [activeTab, setActiveTab] = useState('lobby');
  const [pendingClaimToken, setPendingClaimToken] = useState(() => getPendingClaimTokenFromUrl());
  const [pendingClaimCardId, setPendingClaimCardId] = useState(() => getPendingClaimCardIdFromUrl());
  const [claimModalMessage, setClaimModalMessage] = useState(null); // { text, type, cardId }
  
  const [receivedInvitation, setReceivedInvitation] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [inviteTimeLeft, setInviteTimeLeft] = useState(30);
  const [isRespondingInvite, setIsRespondingInvite] = useState(false);
  const [activeBattleId, setActiveBattleId] = useState(null);

  const invitationCheckInterval = useRef(null);
  const inviteTimerRef = useRef(null);

  const activeTabRef = useRef(activeTab);
  const isRespondingInviteRef = useRef(isRespondingInvite);
  const activeBattleIdRef = useRef(activeBattleId);
  const receivedInvitationRef = useRef(receivedInvitation);
  const hasSentInvitationRef = useRef(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isRespondingInviteRef.current = isRespondingInvite;
  }, [isRespondingInvite]);

  useEffect(() => {
    activeBattleIdRef.current = activeBattleId;
  }, [activeBattleId]);

  useEffect(() => {
    receivedInvitationRef.current = receivedInvitation;
  }, [receivedInvitation]);

  // 1. 處理 URL 傳入的 QR code 領取代幣行為
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const token = params.get('token');
    const cardId = params.get('card_id');
    if (action === 'claim' && token) {
      setPendingClaimToken(token);
      setPendingClaimCardId(cardId);
    }
  }, []);

  // 1.5 登入成功後拉取等級生命對照表與卡牌庫
  useEffect(() => {
    if (player) {
      ApiService.getLevelConfig(player.id)
        .then(res => {
          if (res.success && res.levels) {
            localStorage.setItem('sa_level_config', JSON.stringify(res.levels));
          }
        })
        .catch(err => console.warn('Fetch level config failed, using local fallback', err));

      ApiService.getCards(player.id)
        .then(res => {
          if (res.success && res.cards) {
            console.log('--- 雲端同步卡牌庫 ---', res.cards);
            updateCardsFromSheets(res.cards);
            localStorage.setItem('sa_cards', JSON.stringify(res.cards));
          }
        })
        .catch(err => {
          console.warn('Sync custom cards failed, using cache', err);
          const cached = localStorage.getItem('sa_cards');
          if (cached) updateCardsFromSheets(JSON.parse(cached));
        });
    }
  }, [player]);

  // 2. 登入後自動處理 Pending 的代幣，並監聽對戰邀請廣播
  useEffect(() => {
    let unregisterBroadcast = () => {};

    if (player) {
      if (pendingClaimToken) {
        handleAutoClaimToken(pendingClaimToken, pendingClaimCardId);
      }
      
      invitationCheckInterval.current = setInterval(() => {
        checkInboundInvitations();
      }, 3500);

      unregisterBroadcast = registerBroadcastListener((data) => {
        if (getApiMode() === 'local') {
          if (data.type === 'INVITE' && String(data.receiver_id || '').toLowerCase() === String(player.id || '').toLowerCase()) {
            if (
              isRespondingInviteRef.current || 
              activeBattleIdRef.current || 
              receivedInvitationRef.current ||
              hasSentInvitationRef.current
            ) {
              return;
            }
            setInviteTimeLeft(30);
            setReceivedInvitation({
              invitation_id: data.invitation_id,
              sender_id: data.sender_id,
              sender_name: data.sender_name
            });
          }
        }
      }) || (() => {});
    } else {
      clearInterval(invitationCheckInterval.current);
    }

    return () => {
      clearInterval(invitationCheckInterval.current);
      unregisterBroadcast();
    };
  }, [player, pendingClaimToken]);

  // 2.5 登入狀態與系統開啟定時檢查 (適用於本地 Mock)
  useEffect(() => {
    if (!player || player.role === 'admin' || player.role === 'game_admin') return;

    const checkInterval = setInterval(() => {
      if (getApiMode() === 'local') {
        const gameEnabled = localStorage.getItem('sa_game_enabled') !== 'false';
        const forceLogoutTime = Number(localStorage.getItem('sa_force_logout_time') || '0');
        const lastActive = Number(player.last_active || 0);
        if (!gameEnabled || (lastActive > 0 && lastActive < forceLogoutTime)) {
          localStorage.removeItem('sa_player');
          localStorage.removeItem('sa_active_battle_id');
          setPlayer(null);
          setActiveTab('lobby');
          alert('掌櫃已關閉系統，全體普通玩家強制登出！');
        }
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [player]);

  // 3. 處理收到邀請的 30 秒倒計時
  useEffect(() => {
    if (receivedInvitation) {
      setInviteTimeLeft(30);
      inviteTimerRef.current = setInterval(() => {
        setInviteTimeLeft((prev) => {
          if (prev <= 1) {
            if (inviteTimerRef.current) {
              clearInterval(inviteTimerRef.current);
              inviteTimerRef.current = null;
            }
            setAlertMessage('邀請已過期');
            handleDeclineInvite();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (inviteTimerRef.current) {
        clearInterval(inviteTimerRef.current);
        inviteTimerRef.current = null;
      }
    };
  }, [receivedInvitation]);

  // 4. 定期檢查傳入的切磋邀請 (雲端模式)
  async function checkInboundInvitations() {
    if (!player) return;
    if (getApiMode() === 'cloud') {
      try {
        const res = await ApiService.checkInvitations(player.id);
        if (res.success) {
          if (res.inbound) {
            if (
              isRespondingInviteRef.current ||
              activeBattleIdRef.current ||
              receivedInvitationRef.current ||
              hasSentInvitationRef.current
            ) {
              return;
            }
            setReceivedInvitation(res.inbound);
          } else {
            // 若雲端回傳已無 pending 邀請，且前端目前正顯示著該邀請，代表已被對方召回或過期
            if (receivedInvitationRef.current && !isRespondingInviteRef.current) {
              setReceivedInvitation(null);
              setAlertMessage('對方已召回或邀請已過期。');
            }
          }
          if (res.outbound_accepted) {
            if (!activeBattleIdRef.current) {
              localStorage.setItem('sa_active_battle_id', res.outbound_accepted.battle_id);
              setActiveBattleId(res.outbound_accepted.battle_id);
              setActiveTab('battle');
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function handleAutoClaimToken(token, urlCardId) {
    if (!player || !token) return;
    setPendingClaimToken(null);
    setPendingClaimCardId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    url.searchParams.delete('token');
    url.searchParams.delete('card_id');
    window.history.replaceState({}, document.title, url.pathname);

    try {
      const res = await ApiService.claimQrCode(player.id, token);
      if (res.success) {
        setClaimModalMessage({
          type: 'success',
          text: `${res.message || '領取成功！'}`,
          cardId: res.card_id || urlCardId
        });
        const playerRes = await ApiService.getPlayerData(player.id);
        if (playerRes.success) {
          setPlayer(playerRes.player);
        }
      } else {
        setClaimModalMessage({
          type: 'error',
          text: res.error || res.message || '領取失敗',
          cardId: res.card_id || urlCardId
        });
      }
    } catch (err) {
      setClaimModalMessage({
        type: 'error',
        text: err.message || '領取失敗，請稍後再試',
        cardId: err.card_id || urlCardId
      });
    }
  }

  // 5. 接受切磋邀請
  async function handleAcceptInvite() {
    if (isRespondingInvite) return;
    setIsRespondingInvite(true);

    if (inviteTimerRef.current) {
      clearInterval(inviteTimerRef.current);
      inviteTimerRef.current = null;
    }
    if (!receivedInvitation) {
      setIsRespondingInvite(false);
      return;
    }
    const inv = receivedInvitation;
    setReceivedInvitation(null);
    setInviteTimeLeft(30);
    try {
      const res = await ApiService.respondInvitation(player.id, inv.invitation_id, true);
      if (res.success && res.battle_id) {
        if (getApiMode() === 'local') {
          postLocalBroadcast({
            type: 'INVITE_ACCEPTED',
            invitation_id: inv.invitation_id,
            battle_id: res.battle_id,
            sender_id: inv.sender_id
          });
        }
        localStorage.setItem('sa_active_battle_id', res.battle_id);
        setActiveBattleId(res.battle_id);
        setActiveTab('battle');
      }
    } catch (err) {
      setAlertMessage(err.message || '接受邀請失敗，請重試');
    } finally {
      setIsRespondingInvite(false);
    }
  }

  // 6. 婉拒切磋邀請
  async function handleDeclineInvite() {
    if (isRespondingInvite) return;
    setIsRespondingInvite(true);

    if (inviteTimerRef.current) {
      clearInterval(inviteTimerRef.current);
      inviteTimerRef.current = null;
    }
    if (!receivedInvitation) {
      setIsRespondingInvite(false);
      return;
    }
    const inv = receivedInvitation;
    setReceivedInvitation(null);
    setInviteTimeLeft(30);
    try {
      const res = await ApiService.respondInvitation(player.id, inv.invitation_id, false);
      if (res.success) {
        if (getApiMode() === 'local') {
          postLocalBroadcast({
            type: 'INVITE_REJECTED',
            invitation_id: inv.invitation_id,
            sender_id: inv.sender_id
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRespondingInvite(false);
    }
  }

  // 處理玩家資訊更新
  const handlePlayerUpdate = (updatedPlayer) => {
    setPlayer(updatedPlayer);
  };

  if (!player) {
    return (
      <div className="tcm-login-container">
        <Login onLoginSuccess={setPlayer} />
      </div>
    );
  }

  const isInBattle = activeTab === 'battle' && activeBattleId;

  return (
    <div className="tcm-lobby-container">
      <div className={`tcm-lobby-shell glass-panel glass-panel-neon ${isInBattle ? 'tcm-battle-mode-shell' : ''}`}>
        
        {/* 大廳頁首 */}
        <header className="tcm-lobby-header flex flex-col gap-4">
          {activeTab === 'lobby' ? (
            /* 顯示大廳 Header */
            <>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 mx-auto text-center">
                  <div className="p-2 rounded bg-amber-955/40 border border-amber-500/30 text-amber-400">
                    <Swords size={20} />
                  </div>
                  <div className="text-center">
                    <h1 className="text-lg md:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 font-mono">
                      百草醫館
                    </h1>
                    <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Apothecary Training Ground</p>
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-center">
                <button
                  id="btn-logout"
                  onClick={() => {
                    setPlayer(null);
                    setActiveTab('lobby');
                  }}
                  className="btn-outline w-full py-2 text-[12px] flex items-center justify-center gap-1.5 hover:text-red-400 hover:border-red-500/30"
                >
                  <LogOut size={12} />
                  退出醫館
                </button>
              </div>
            </>
          ) : (
            /* 顯示其他分頁的 Header */
            <div className="flex flex-col w-full gap-3">
              <div className="flex justify-start w-full">
                {activeTab === 'battle' && activeBattleId ? (
                  <span className="text-xs text-amber-500/80 font-serif">
                    ⚔️ 醫道切磋進行中，請完成對決...
                  </span>
                ) : (
                  <button
                    id="btn-back-lobby"
                    onClick={() => setActiveTab('lobby')}
                    className="btn-outline py-1 px-3 text-xs flex items-center gap-1 hover:text-amber-400"
                  >
                    返回大廳
                  </button>
                )}
              </div>
              
              {!(activeTab === 'battle' && activeBattleId) && (
                <div className="text-center w-full">
                  <h1 className="text-2xl md:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 font-mono">
                    {TAB_TITLES[activeTab] || '背包'}
                  </h1>
                </div>
              )}
            </div>
          )}
        </header>

        {/* 主內容區 */}
        <main className="tcm-lobby-main">
          {activeTab === 'lobby' ? (
            <div className="tcm-lobby-menu-container space-y-6">
              {/* 顯示玩家 HUD */}
              <PlayerHUD player={player} />

              {/* 選單網格 */}
              {player.role === 'player' && (
                <div className="tcm-lobby-grid">
                  <button 
                    id="btn-menu-inventory"
                    onClick={() => setActiveTab('inventory')}
                    className="tcm-lobby-grid-btn"
                  >
                    <span className="tcm-lobby-btn-icon text-amber-400"><Briefcase size={28} /></span>
                    <span className="tcm-lobby-btn-text">背包</span>
                  </button>

                  <button 
                    id="btn-menu-equip"
                    onClick={() => setActiveTab('equip')}
                    className="tcm-lobby-grid-btn"
                  >
                    <span className="tcm-lobby-btn-icon text-blue-400"><Swords size={28} /></span>
                    <span className="tcm-lobby-btn-text">裝備</span>
                  </button>

                  <button 
                    id="btn-menu-skills"
                    onClick={() => setActiveTab('skills')}
                    className="tcm-lobby-grid-btn"
                  >
                    <span className="tcm-lobby-btn-icon text-emerald-400"><Sparkles size={28} /></span>
                    <span className="tcm-lobby-btn-text">技能</span>
                  </button>

                  <button 
                    id="btn-menu-battle"
                    onClick={() => {
                      setActiveTab('battle');
                      setActiveBattleId(null);
                      const savedBattleId = localStorage.getItem('sa_active_battle_id');
                      if (savedBattleId) {
                        localStorage.removeItem('sa_active_battle_id');
                      }
                    }}
                    className="tcm-lobby-grid-btn"
                  >
                    <span className="tcm-lobby-btn-icon text-red-400"><Trophy size={28} /></span>
                    <span className="tcm-lobby-btn-text">戰鬥</span>
                  </button>
                </div>
              )}

              {player.role === 'game_admin' && (
                <div className="tcm-lobby-grid grid-cols-1">
                  <button 
                    id="btn-menu-admin"
                    onClick={() => setActiveTab('admin')}
                    className="tcm-lobby-grid-btn py-6 flex flex-col items-center justify-center gap-2"
                  >
                    <span className="tcm-lobby-btn-icon text-amber-400"><ShieldCheck size={36} /></span>
                    <span className="tcm-lobby-btn-text text-sm">分藥面板</span>
                  </button>
                </div>
              )}

              {player.role === 'admin' && (
                <div className="tcm-lobby-grid">
                  <button 
                    id="btn-menu-admin"
                    onClick={() => setActiveTab('admin')}
                    className="tcm-lobby-grid-btn py-5 flex flex-col items-center justify-center gap-2"
                  >
                    <span className="tcm-lobby-btn-icon text-amber-400"><ShieldCheck size={32} /></span>
                    <span className="tcm-lobby-btn-text text-sm">分藥面板</span>
                  </button>

                  <button 
                    id="btn-menu-game-admin"
                    onClick={() => setActiveTab('game_admin')}
                    className="tcm-lobby-grid-btn py-5 flex flex-col items-center justify-center gap-2"
                  >
                    <span className="tcm-lobby-btn-icon text-red-400"><Settings2 size={32} /></span>
                    <span className="tcm-lobby-btn-text text-sm">大掌櫃面板</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="tcm-lobby-tab-content">
              {activeTab === 'inventory' && (
                <InventoryTab player={player} onPlayerUpdate={handlePlayerUpdate} />
              )}
              {activeTab === 'equip' && (
                <EquipTab player={player} onPlayerUpdate={handlePlayerUpdate} />
              )}
              {activeTab === 'skills' && (
                <SkillsTab player={player} onPlayerUpdate={handlePlayerUpdate} />
              )}
              {activeTab === 'battle' && (
                <BattleTab 
                  player={player} 
                  onPlayerUpdate={handlePlayerUpdate} 
                  activeBattleId={activeBattleId}
                  onClearBattleId={() => setActiveBattleId(null)}
                  onStartBattle={(id) => {
                    localStorage.setItem('sa_active_battle_id', id);
                    setActiveBattleId(id);
                  }}
                  onSentInvitationChange={(inv) => {
                    hasSentInvitationRef.current = !!inv;
                  }}
                />
              )}
              {activeTab === 'admin' && (
                <AdminPanel player={player} />
              )}
              {activeTab === 'game_admin' && (
                <GameAdminPanel player={player} onPlayerUpdate={handlePlayerUpdate} />
              )}
            </div>
          )}
        </main>

        {/* 頁尾 */}
        {!isInBattle && (
          <footer className="py-4 border-t border-amber-955/30 text-center text-xs text-gray-500 font-serif bg-black/10 mt-4">
            <p>© 2026 百草醫館修煉場 Apothecary Training Ground.</p>
          </footer>
        )}

      </div>

      {/* ==================== 浮動視窗：收到切磋邀請 ==================== */}
      {receivedInvitation && (
        <div className="tcm-floating-invite-overlay">
          <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 animate-shake">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-amber-955/40 text-amber-500 border border-amber-500/20 animate-bounce mx-auto">
                <BellRing size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-200 font-serif">收到切磋邀請</h3>
              <p className="text-sm text-gray-400 leading-relaxed font-serif text-center">
                同道 <span className="text-amber-400 font-bold">[ {receivedInvitation.sender_name} ]</span> 向你發起醫道切磋...
                <br />
                <span className="text-xs text-rose-400 font-bold mt-1 block">(剩餘考慮時間：{inviteTimeLeft} 秒)</span>
              </p>
            </div>

            {isRespondingInvite ? (
              <div className="text-center py-2 space-y-2">
                <div className="w-6 h-6 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mx-auto"></div>
                <p className="text-xs text-amber-400 font-bold font-serif animate-pulse">正在處理切磋回應中...</p>
              </div>
            ) : (
              <div className="flex justify-center gap-4 pt-2">
                <button
                  id="btn-decline-invite"
                  onClick={handleDeclineInvite}
                  disabled={isRespondingInvite}
                  className="btn-neon-decline px-6 py-2 text-xs font-bold disabled:opacity-50"
                >
                  拒絕
                </button>
                <button
                  id="btn-accept-invite"
                  onClick={handleAcceptInvite}
                  disabled={isRespondingInvite}
                  className="btn-neon px-6 py-2 text-xs font-bold disabled:opacity-50"
                >
                  接受
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 浮動視窗：QR Code 領取結果 ==================== */}
      {claimModalMessage && (
        <div className="tcm-floating-invite-overlay">
          <div className="tcm-floating-invite-card tcm-claim-result-card glass-panel glass-panel-neon p-4 text-center">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-200">
                {claimModalMessage.type === 'success' ? '🎉 領取成功' : '❌ 領取失敗'}
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">{claimModalMessage.text}</p>
            </div>

            {/* 卡片圖示與詳情顯示 */}
            {(() => {
              let rewardCards = [];
              if (claimModalMessage.cardId && CARDS[claimModalMessage.cardId]) {
                rewardCards = [CARDS[claimModalMessage.cardId]];
              } else {
                rewardCards = detectRewardCards(claimModalMessage.text);
              }
              
              if (rewardCards.length === 0) return null;
              return (
                <div className="tcm-claim-card-scroll-area">
                  {rewardCards.map(card => {
                    const cardRarity = RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"];
                    return (
                      <div 
                        key={card.id}
                        className={`game-card border ${cardRarity.border} ${cardRarity.shadow} relative overflow-hidden bg-black/55 rounded-lg mx-auto flex-shrink-0`}
                        style={{ width: '180px', height: '80px', minHeight: 'auto', padding: '0' }}
                      >
                        {card.image_url ? (
                          <img 
                            src={convertGoogleDriveUrl(card.image_url)} 
                            alt={card.name} 
                            className="absolute inset-0 w-full h-full object-cover flex-shrink-0"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-amber-950/10 to-emerald-950/10 flex items-center justify-center">
                            <Leaf size={24} className="text-amber-600/30 animate-pulse" />
                          </div>
                        )}
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-black/75 py-1 px-1.5 flex flex-col items-center justify-center text-center border-t border-amber-500/10 leading-none z-10"
                          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
                        >
                          <h4 className={`text-[10px] font-black font-serif ${cardRarity.text} leading-tight`}>{card.name}</h4>
                          <span className="text-[7px] uppercase tracking-widest text-amber-700/80 font-mono font-bold mt-0.5">
                            {card.rarity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="pt-1">
              <button
                id="btn-close-claim-modal"
                onClick={() => setClaimModalMessage(null)}
                className="btn-neon w-full py-1.5 text-xs font-bold"
                style={{ minHeight: '32px' }}
              >
                收下獎勵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 浮動視窗：系統提醒訊息 ==================== */}
      {alertMessage && (
        <div className="tcm-floating-invite-overlay">
          <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 text-center animate-shake">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-rose-955/40 text-rose-400 border border-rose-500/20 animate-pulse mx-auto">
                <ShieldAlert size={24} className="shrink-0" />
              </div>
              <h3 className="text-lg font-bold text-gray-200 font-serif">醫館提示</h3>
              <p className="text-sm text-gray-400 leading-relaxed font-serif text-center">{alertMessage}</p>
            </div>
            <div className="pt-2">
              <button
                id="btn-alert-close"
                onClick={() => setAlertMessage(null)}
                className="btn-neon px-6 py-2 text-xs font-bold"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
