import React, { useState, useEffect } from 'react';
import { CARDS } from '../services/cardData';
import { ApiService, getApiMode } from '../services/api';
import {
  ShieldAlert, Settings2, Power, Check, RefreshCw,
  Search, Shield, ShieldCheck
} from 'lucide-react';

export default function GameAdminPanel({ player, onPlayerUpdate }) {
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [searchedStaffId, setSearchedStaffId] = useState('');
  const [staffQuotas, setStaffQuotas] = useState([]);

  // 卡牌設定狀態 (手機端極簡分步 UI)
  const [selectedType, setSelectedType] = useState('equipment'); // 'equipment' | 'skill'
  const [selectedCardId, setSelectedCardId] = useState('');
  const [quotaValue, setQuotaValue] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 初始化取得當前系統狀態
  useEffect(() => {
    fetchSystemStatus();
  }, []);

  async function fetchSystemStatus() {
    try {
      if (getApiMode() === 'local') {
        setLoginEnabled(localStorage.getItem('sa_game_enabled') !== 'false');
      } else {
        const res = await ApiService.getPlayerData(player.id);
        if (res.success && res.system_login_enabled !== undefined) {
          setLoginEnabled(res.system_login_enabled);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // 切換登入功能開關
  const handleToggleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    const nextState = !loginEnabled;

    try {
      const res = await ApiService.gameAdminToggleLogin(player.id, nextState);
      if (res.success) {
        setLoginEnabled(res.game_enabled);
        setSuccess(`系統設定已更新！現在普通玩家登入狀態：[ ${res.game_enabled ? '開放登入' : '關閉登入/維護中'} ]`);
      }
    } catch (err) {
      setError(err.message || '切換系統開關失敗');
    } finally {
      setLoading(false);
    }
  };

  // 總開關：系統重置與強踢
  const handleResetSystem = async () => {
    if (!window.confirm("⚠️ 警告：這將會強制登出所有在線普通玩家，終止並刪除所有正在進行的對局與邀請！\n確定要啟動總開關嗎？")) {
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await ApiService.gameAdminResetSystem(player.id);
      if (res.success) {
        setSuccess(res.message || "💥 成功啟動總開關！系統已重置，普通玩家已被退房。");
      }
    } catch (err) {
      setError(err.message || "重置系統失敗");
    } finally {
      setLoading(false);
    }
  };

  // 查詢工作人員配額
  const handleSearchStaff = async (e) => {
    e.preventDefault();
    if (!targetStaffId.trim()) {
      setError('請輸入目標工作人員ID');
      return;
    }
    fetchStaffQuotas(targetStaffId.trim());
  };

  const fetchStaffQuotas = async (staffId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await ApiService.adminGetQuotas(staffId);
      if (res.success) {
        setSearchedStaffId(staffId);

        // 整理已有的配額，沒有的卡牌設為 0
        const quotaMap = {};
        res.quotas.forEach(q => {
          quotaMap[q.card_id] = q.quota;
        });

        const fullList = Object.keys(CARDS).map(cid => ({
          card_id: cid,
          card_name: CARDS[cid].name,
          type: CARDS[cid].type === 'equipment' ? '裝備' : '技能',
          quota: quotaMap[cid] !== undefined ? quotaMap[cid] : 0
        }));

        setStaffQuotas(fullList);
        setSuccess(`查詢成功，已載入工作人員 [ ${staffId} ] 的卡牌配額！`);
      }
    } catch (err) {
      setError(err.message || '查詢工作人員配額失敗，請確認該帳號是否存在且具備管理權限。');
      setSearchedStaffId('');
    } finally {
      setLoading(false);
    }
  };

  // 自動根據種類與卡牌配額更新 input 預設值
  useEffect(() => {
    const filtered = Object.keys(CARDS).filter(cid => CARDS[cid].type === selectedType);
    if (filtered.length > 0 && !filtered.includes(selectedCardId)) {
      setSelectedCardId(filtered[0]);
    }
  }, [selectedType]);

  useEffect(() => {
    if (selectedCardId && staffQuotas.length > 0) {
      const qObj = staffQuotas.find(q => q.card_id === selectedCardId);
      if (qObj) {
        setQuotaValue(qObj.quota === '無限' ? 0 : Number(qObj.quota));
      } else {
        setQuotaValue(0);
      }
    }
  }, [selectedCardId, staffQuotas]);

  // 更新配額
  const handleUpdateQuota = async (e) => {
    e.preventDefault();
    if (!searchedStaffId || !selectedCardId) return;
    setError('');
    setSuccess('');
    setLoading(true);

    if (quotaValue === undefined || isNaN(Number(quotaValue)) || Number(quotaValue) < 0) {
      setError('請輸入大於或等於 0 的數字');
      setLoading(false);
      return;
    }

    try {
      const res = await ApiService.gameAdminUpdatePlayer(player.id, searchedStaffId, {
        quota_card_id: selectedCardId,
        quota_val: Number(quotaValue)
      });
      if (res.success) {
        setSuccess(`成功將工作人員 [ ${searchedStaffId} ] 的「${CARDS[selectedCardId].name}」配額修改為 ${quotaValue}！`);
        // 重新拉取配額
        fetchStaffQuotas(searchedStaffId);
      }
    } catch (err) {
      setError(err.message || '更新配額失敗');
    } finally {
      setLoading(false);
    }
  };

  // 過濾當前所選種類的卡牌
  const filteredCards = Object.keys(CARDS).filter(cid => CARDS[cid].type === selectedType);
  const currentQuotaObj = staffQuotas.find(q => q.card_id === selectedCardId);
  const currentQuotaDisplay = currentQuotaObj ? currentQuotaObj.quota : 0;

  return (
    <div className="space-y-6 flex flex-col w-full max-w-full items-center text-center">

      <div className="max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-100 flex items-center justify-center gap-2 font-serif">
          <Settings2 size={22} className="text-red-500" />
          管理員主控台
        </h2>
        <p className="text-xs text-gray-400 mt-1.5 font-serif leading-relaxed">
          在此可管理系統總開關與登入權限，並調整工作人員的卡牌發放配額。
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-955/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-center justify-center gap-2 w-full max-w-md">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-955/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg flex items-center justify-center gap-2 w-full max-w-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>{success}</span>
        </div>
      )}

      {/* 總開關 UI */}
      <div className="glass-panel p-5 border-red-950/30 bg-red-950/5 space-y-4 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 border-b border-gray-900 pb-2">
          <Power size={18} className="text-rose-500" />
          <h3 className="text-sm font-bold text-gray-300">
            系統維護與控制
          </h3>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 justify-center">
              <span className="text-xs text-gray-400 font-serif">系統狀態：</span>
              {loginEnabled ? (
                <span className="px-2.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono">
                  🟢 開放玩家登入
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded bg-rose-950/40 border border-rose-500/30 text-rose-400 text-[10px] font-bold font-mono">
                  🔴 封鎖維護中
                </span>
              )}
            </div>

            <button
              disabled={loading}
              onClick={handleToggleLogin}
              className={`w-full px-4 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${loginEnabled
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-400 hover:bg-rose-900/10'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/10'
                }`}
            >
              <Power size={13} />
              {loginEnabled ? "切換：封鎖玩家登入" : "切換：開放玩家登入"}
            </button>
          </div>

          <div className="border-t border-gray-900/50 pt-3">
            <button
              onClick={handleResetSystem}
              disabled={loading}
              className="w-full btn-neon-danger py-2.5 text-xs font-bold tracking-wider rounded-lg transition-all"
            >
              💥 重置系統並強踢玩家
            </button>
          </div>
        </div>
      </div>

      {/* 工作人員卡牌配額設定 (手機端自適應極簡設計) */}
      <div className="glass-panel p-5 border-gray-800 space-y-4 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 border-b border-gray-900 pb-2">
          <ShieldCheck size={18} className="text-purple-400" />
          <h3 className="text-sm font-bold text-gray-300">
            工作人員卡牌配額設定
          </h3>
        </div>

        {!searchedStaffId ? (
          /* 第一步：查詢工作人員帳號 */
          <form onSubmit={handleSearchStaff} className="space-y-3">
            <p className="text-xs text-gray-400 font-serif leading-relaxed text-center">
              請輸入想要調整配額的工作人員ID，來查看並編輯其卡片分配額度。
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={targetStaffId}
                onChange={(e) => setTargetStaffId(e.target.value)}
                placeholder="輸入工作人員帳號 (如 staff)"
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 text-center font-mono"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-neon w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Search size={14} />
                查詢配額
              </button>
            </div>
          </form>
        ) : (
          /* 第二步：分步設定配額，完美防破圖 */
          <form onSubmit={handleUpdateQuota} className="space-y-4 text-left">
            <div className="flex justify-between items-center bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/30 text-xs">
              <span className="text-[11px] text-purple-300 font-bold font-mono">
                目標工作人員ID: <span className="text-white text-xs font-bold">{searchedStaffId}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchedStaffId('');
                  setTargetStaffId('');
                  setStaffQuotas([]);
                }}
                className="text-[10px] text-gray-400 hover:text-white underline font-serif"
              >
                切換人員
              </button>
            </div>

            {/* 1. 選擇卡牌種類 */}
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-400">1. 選擇卡牌種類：</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
              >
                <option value="equipment">裝備卡 (Equipment)</option>
                <option value="skill">技能卡 (Skill)</option>
              </select>
            </div>

            {/* 2. 選擇卡牌名稱 */}
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-400">2. 選擇卡牌名稱：</label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
              >
                {filteredCards.map(cid => (
                  <option key={cid} value={cid}>
                    {CARDS[cid].name} ({CARDS[cid].element || '無'})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. 顯示當前配額與輸入新配額 */}
            <div className="bg-gray-950/60 p-3 rounded-lg border border-gray-900 flex flex-col items-center justify-center text-center gap-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                當前配額
              </div>
              <div className="text-base font-black text-purple-400 font-mono">
                {currentQuotaDisplay}
              </div>

              {currentQuotaDisplay === '無限' ? (
                <p className="text-[10px] text-emerald-400 font-serif mt-1">該卡牌無限制配額，無須設定。</p>
              ) : (
                <div className="w-full space-y-1 mt-1 text-left">
                  <label className="block text-[11px] text-gray-400 text-center">3. 輸入新發放限額：</label>
                  <input
                    type="number"
                    min="0"
                    value={quotaValue}
                    onChange={(e) => setQuotaValue(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-center text-xs text-amber-400 font-bold font-mono focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* 送出按鈕 */}
            <button
              type="submit"
              disabled={loading || currentQuotaDisplay === '無限'}
              className="btn-neon w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1"
            >
              修改配額
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
