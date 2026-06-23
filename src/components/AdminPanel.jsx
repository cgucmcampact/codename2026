import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { CARDS } from '../services/cardData';
import { ApiService } from '../services/api';
import { 
  QrCode, Clipboard, Check, RefreshCw, 
  User, ShieldCheck, Key, Info, Copy
} from 'lucide-react';

export default function AdminPanel({ player }) {
  const [quotas, setQuotas] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tasksConfig, setTasksConfig] = useState([]);
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(null);
  const [playerTasks, setPlayerTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const canvasRef = useRef(null);

  // 當生成了 Token 時，在 Canvas 上繪製 QR Code
  useEffect(() => {
    if (generatedToken && canvasRef.current) {
      const claimUrl = `${window.location.origin}${window.location.pathname}?action=claim&token=${generatedToken}`;
      QRCode.toCanvas(
        canvasRef.current, 
        claimUrl, 
        {
          width: 180,
          margin: 1.5,
          color: {
            dark: '#1e1b4b', // 暗藍色
            light: '#ffffff' // 白色背景
          }
        }, 
        (err) => {
          if (err) console.error("QR Draw Error:", err);
        }
      );
    }
  }, [generatedToken]);

  // 獲取分配卡牌配額
  const fetchQuotas = async () => {
    setLoading(true);
    try {
      const res = await ApiService.adminGetQuotas(player.id);
      if (res.success) {
        setQuotas(res.quotas || []);
        if (res.quotas && res.quotas.length > 0) {
          const activeQ = res.quotas.find(q => q.quota === '無限' || Number(q.quota) > 0);
          setSelectedCardId(activeQ ? activeQ.card_id : res.quotas[0].card_id);
        }
      }
    } catch (err) {
      setError(err.message || '獲取管理員配額失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取玩家進行中任務列表
  const fetchActiveTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await ApiService.adminGetTasks(player.id);
      if (res.success) {
        setPlayerTasks(res.player_tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchTasksConfig = async () => {
    try {
      const res = await ApiService.getTasksConfig(player.id);
      if (res.success && res.tasks) {
        setTasksConfig(res.tasks);
      }
    } catch (err) {
      console.error("Fetch tasks config failed:", err);
    }
  };

  // 初始化
  useEffect(() => {
    fetchQuotas();
    fetchActiveTasks();
    fetchTasksConfig();
  }, [player.id]);

  const handleGenerateQr = async () => {
    if (!selectedCardId) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await ApiService.adminGenerateQr(player.id, selectedCardId);
      if (res.success && res.token) {
        setGeneratedToken(res.token);
        setSuccess(`成功為 [ ${res.card_name} ] 生成兌換代碼！`);
        fetchQuotas();
      }
    } catch (err) {
      setError(err.message || '生成失敗');
      setGeneratedToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedToken) return;
    const claimUrl = `${window.location.origin}${window.location.pathname}?action=claim&token=${generatedToken}`;
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 flex flex-col items-center justify-center text-center w-full max-w-full">
      
      <div className="flex flex-col items-center justify-center text-center max-w-md">
        <h2 className="text-xl font-bold text-gray-100 flex items-center justify-center gap-2 font-serif">
          <ShieldCheck size={22} className="text-amber-500" />
          分藥大掌櫃認證主控台
        </h2>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed font-serif">
          在此可執行管理功能：生成藥貼/方劑香箋 QR Code 供弟子掃描領取，以及監控所有試藥弟子的百子櫃任務代碼。
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-955/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-center justify-center gap-2 w-full max-w-md mx-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-955/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg flex items-center justify-center gap-2 w-full max-w-md mx-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl">
        
        {/* 1. QR Code 領卡生成器 */}
        <div className="glass-panel p-6 border-gray-800 space-y-4 flex flex-col items-center text-center w-full max-w-full overflow-hidden">
          <h3 className="text-sm font-bold text-gray-300 flex items-center justify-center gap-1.5 border-b border-gray-900 pb-3 w-full">
            <QrCode size={16} className="text-purple-400" />
            卡牌 QR Code 線上生成器
          </h3>

          <div className="w-full flex flex-col items-center">
            <label className="block text-xs text-gray-400 mb-1.5 text-center">選擇要生成的卡牌 (依配額)：</label>
            <div className="flex flex-col sm:flex-row gap-2 w-full items-center justify-center">
              <select
                id="select-admin-card"
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full sm:flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-purple-500 text-center"
              >
                {quotas.map(q => {
                  const card = CARDS[q.card_id];
                  const hasQuota = q.quota === '無限' || Number(q.quota) > 0;
                  return (
                    <option 
                      key={q.card_id} 
                      value={q.card_id} 
                      disabled={!hasQuota}
                      className={!hasQuota ? 'text-gray-600' : ''}
                    >
                      {q.card_name} ({card?.type === 'equipment' ? '裝備' : '技能'}) - 剩餘額度: {q.quota}
                    </option>
                  );
                })}
              </select>

              <button
                id="btn-admin-generate"
                disabled={loading || quotas.length === 0}
                onClick={handleGenerateQr}
                className="btn-neon py-2 px-4 text-xs font-bold w-full sm:w-auto shrink-0"
              >
                {loading ? '產生中...' : '生成兌換碼'}
              </button>
            </div>
          </div>

          {generatedToken && (
            <div className="p-4 bg-gray-950/60 border border-gray-900 rounded-xl flex flex-col items-center gap-4 justify-center w-full max-w-full overflow-hidden">
              {/* QR Code Canvas */}
              <div className="bg-white p-2 rounded-lg border border-purple-500/20 shadow-md flex items-center justify-center max-w-full overflow-hidden">
                <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }}></canvas>
              </div>

              {/* 資訊與連結 */}
              <div className="text-center space-y-2 w-full max-w-full overflow-hidden flex flex-col items-center justify-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">兌換代碼 Token</div>
                <div className="font-mono text-xs text-purple-300 font-bold break-all bg-purple-950/30 p-2 rounded border border-purple-900/20 w-full select-all text-center">
                  {generatedToken}
                </div>
                <div className="flex justify-center w-full pt-1">
                  <button
                    id="btn-admin-copy-link"
                    onClick={handleCopyLink}
                    className="btn-outline py-1.5 px-4 text-[10px] font-bold flex items-center gap-1.5 mx-auto"
                  >
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Clipboard size={11} />}
                    {copied ? "已複製連結" : "複製領獎網址"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. 任務認證密碼表 */}
        <div className="glass-panel p-6 border-gray-800 space-y-4 flex flex-col items-center text-center w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-900 pb-3 w-full">
            <div className="flex items-center gap-1.5 justify-center flex-1">
              <Key size={16} className="text-yellow-500" />
              <h3 className="text-sm font-bold text-gray-300">
                小任務認證區
              </h3>
            </div>

            <button
              id="btn-tasks-refresh"
              onClick={fetchActiveTasks}
              className="btn-outline p-1.5 rounded hover:text-purple-300 shrink-0"
              title="整理列表"
            >
              <RefreshCw size={12} className={tasksLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3 w-full">
            {playerTasks.length === 0 ? (
              <div className="py-16 text-center text-gray-600 text-xs w-full">
                目前沒有任何玩家正在進行小任務
              </div>
            ) : (
              playerTasks.map((pt, idx) => (
                <div key={pt.username} className="p-3 bg-gray-900/40 border border-gray-950 rounded-xl space-y-2 text-center flex flex-col items-center w-full">
                  <div className="flex flex-col sm:flex-row justify-between items-center text-xs gap-1 w-full border-b border-gray-800/45 pb-1">
                    <span className="font-bold text-gray-200 flex items-center gap-1 justify-center">
                      <User size={13} className="text-purple-400" />
                      {pt.nickname} ({pt.username})
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      進行中數: {pt.tasks.length}
                    </span>
                  </div>

                  <div className="space-y-1.5 w-full">
                    {pt.tasks.map((task, tIdx) => {
                      const gridName = tasksConfig.find(c => c.grid_index === task.grid_index)?.name;
                      const taskDisplayName = gridName ? `藥斗 #${task.grid_index + 1} (${gridName})` : `藥斗 #${task.grid_index + 1}`;
                      
                      return (
                        <div 
                          key={tIdx} 
                          className="bg-black/40 border border-gray-900 rounded p-2 flex flex-col sm:flex-row items-center justify-between text-xs font-mono gap-2 w-full"
                        >
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className="text-yellow-500 text-[11px] font-bold text-center">{taskDisplayName}</span>
                            <button
                              onClick={() => {
                                const cfg = tasksConfig.find(c => c.grid_index === task.grid_index);
                                if (cfg) {
                                  setSelectedDetailTask(cfg);
                                } else {
                                  setSelectedDetailTask({
                                    name: taskDisplayName,
                                    detail: "詳細藥理修煉規則：請至醫館找執藥師進行該項藥物辨識或煎煮修煉。完成後由執藥師認證並核發通關代碼。"
                                  });
                                }
                              }}
                              className="text-gray-400 hover:text-amber-400 p-0.5 shrink-0"
                              title="查看規則說明"
                            >
                              <Info size={13} />
                            </button>
                          </div>
                          
                          <button
                            onClick={() => setShowCodeModal({ taskName: taskDisplayName, code: task.password })}
                            className="btn-outline py-0.5 px-2 text-[10px] text-yellow-500 border-yellow-500/20 hover:bg-yellow-950/20 font-bold w-full sm:w-auto text-center"
                          >
                            產生通關代碼
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ==================== 浮動視窗：小任務規則與草藥常識 ==================== */}
      {selectedDetailTask && createPortal(
        <div className="tcm-floating-invite-overlay">
          <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 max-w-md w-11/12 text-center animate-fade-in">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-amber-400 font-serif">
                【{selectedDetailTask.name}】規則與草藥常識
              </h3>
              <div className="text-xs text-gray-300 font-serif leading-relaxed text-left whitespace-pre-line max-h-60 overflow-y-auto p-3 bg-black/40 rounded border border-gray-900">
                {selectedDetailTask.detail}
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSelectedDetailTask(null)}
                className="btn-neon px-6 py-2 text-xs font-bold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== 浮動視窗：通關代碼 ==================== */}
      {showCodeModal && createPortal(
        <div className="tcm-floating-invite-overlay">
          <div className="tcm-floating-invite-card glass-panel glass-panel-neon p-6 space-y-4 max-w-sm w-11/12 text-center animate-fade-in">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-amber-400 font-serif">通關代碼已產生 - {showCodeModal.taskName}</h3>
              <p className="text-[11px] text-gray-400 font-serif">請將此通關代碼交給弟子輸入以通過挑戰：</p>
              <div className="font-mono text-lg text-yellow-300 font-bold bg-yellow-950/40 p-3 rounded border border-yellow-800/30 tracking-widest select-all">
                {showCodeModal.code}
              </div>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showCodeModal.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-outline py-2 px-4 text-xs font-bold flex items-center justify-center gap-1"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? '已複製' : '複製代碼'}
              </button>
              <button
                onClick={() => setShowCodeModal(null)}
                className="btn-neon py-2 px-4 text-xs font-bold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
