import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ApiService } from '../services/api';
import { CARDS, RARITY_COLORS, detectRewardCards, convertGoogleDriveUrl } from '../services/cardData';
import {
  Briefcase, CheckCircle2, Lock, Play, ClipboardCheck,
  Camera, CameraOff, QrCode, Sparkles, X, Gift, Leaf
} from 'lucide-react';
import cardPlaceholder from '../assets/card_placeholder.png';

export default function InventoryTab({ player, onPlayerUpdate }) {
  const [activeSubTab, setActiveSubTab] = useState('inventory'); // 'inventory' | 'bingo'
  const [customFilter, setCustomFilter] = useState('all'); // 'all' | 'equipment' | 'skill'

  // 任務配置
  const [tasksConfig, setTasksConfig] = useState([]);
  const [selectedGridIndex, setSelectedGridIndex] = useState(null);
  const [taskPassword, setTaskPassword] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskFeedback, setTaskFeedback] = useState(null); // { text, type }

  // 掃碼兌換狀態
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // 1. 動態加載 jsQR CDN 用於掃描
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 2. 當打開掃描器時，啟動相機
  useEffect(() => {
    if (scannerOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scannerOpen]);

  // 3. 拉取中藥房百子藥櫃任務配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await ApiService.getTasksConfig(player.id);
        if (res.success) {
          setTasksConfig(res.tasks || []);
        }
      } catch (e) {
        console.error('Fetch tasks config failed, using fallback', e);
      }
    };
    fetchConfig();
  }, [player.id]);

  async function startCamera() {
    setScanError('');
    setScanSuccess('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsCameraActive(false);
      setScanError('您的瀏覽器或 App 內建瀏覽器（如 LINE）不支援相機掃描。請點擊右上角以 Safari 或 Chrome 開啟網頁，或使用下方「手動輸入兌換」。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      // 輪詢等待 videoRef.current 掛載成功，保證相機畫面能正確顯示
      for (let i = 0; i < 10; i++) {
        if (videoRef.current) break;
        await new Promise(r => setTimeout(r, 50));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(err => console.warn("video play pending:", err));
        setIsCameraActive(true);
        startDecoding();
      } else {
        console.error("videoRef is still null");
        setScanError('無法載入相機視窗。');
      }
    } catch (err) {
      console.error('Camera open failed:', err);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setScanError('相機權限被拒絕，請檢查瀏覽器設定，允許此網頁存取相機。');
      } else {
        setScanError('無法啟用相機，請確認設備有後置鏡頭，或使用下方「手動輸入兌換」。');
      }
    }
  }

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }

  function startDecoding() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !streamRef.current) return;
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        canvas.height = videoRef.current.videoHeight;
        canvas.width = videoRef.current.videoWidth;
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        if (window.jsQR) {
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (code) {
            handleDecodedToken(code.data);
          }
        }
      }
    }, 400);
  }

  async function handleDecodedToken(text) {
    stopCamera();
    setScanError('');

    let token = text;
    try {
      if (text.includes('token=')) {
        const urlParams = new URLSearchParams(text.split('?')[1]);
        token = urlParams.get('token') || text;
      }
    } catch (e) {
      console.warn('Url parse failed');
    }

    try {
      const res = await ApiService.claimQrCode(player.id, token);
      if (res.success) {
        setScannerOpen(false);
        setRewardMessage(res.message || '兌換成功！');
        onPlayerUpdate(res.player);
      }
    } catch (err) {
      setScanError(err.message || '兌換失敗');
      setTimeout(() => {
        if (scannerOpen) startCamera();
      }, 1500);
    }
  }

  async function handleManualClaim(e) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setScanError('');
    setScanSuccess('');
    try {
      const res = await ApiService.claimQrCode(player.id, manualToken.trim());
      if (res.success) {
        setScannerOpen(false);
        setRewardMessage(res.message || '兌換成功！');
        setManualToken('');
        onPlayerUpdate(res.player);
      }
    } catch (err) {
      setScanError(err.message || '兌換失敗');
    }
  }

  // 16 宮格任務流程
  const handleGridClick = async (index) => {
    setSelectedGridIndex(index);
    setTaskFeedback(null);
    setTaskPassword('');
    setTaskModalOpen(true);

    const tasks = player.tasks_progress || {};
    const task = tasks[String(index)] || { status: 'available', completed: false };

    // 如果任務尚未完成 (為 available 或 active 狀態)，在背景觸發 startTask 確保口令同步寫入 active_tasks 工作表
    if (task.status !== 'completed' && !task.completed) {
      try {
        const res = await ApiService.startTask(player.id, index);
        if (res.success) {
          onPlayerUpdate({
            ...player,
            tasks_progress: res.tasks_progress
          });
        }
      } catch (err) {
        console.error('Auto start task failed:', err);
      }
    }
  };

  const handleStartTask = async () => {
    if (selectedGridIndex === null) return;
    setTaskFeedback(null);
    try {
      const res = await ApiService.startTask(player.id, selectedGridIndex);
      if (res.success) {
        onPlayerUpdate({
          ...player,
          tasks_progress: res.tasks_progress
        });
        setTaskFeedback({ text: `小任務已成功開始！請向工作人員領取密碼。`, type: 'success' });
      }
    } catch (err) {
      setTaskFeedback({ text: err.message || '開始任務失敗', type: 'error' });
    }
  };

  const handleClaimTask = async (e) => {
    e.preventDefault();
    if (selectedGridIndex === null || !taskPassword.trim()) return;
    setTaskFeedback(null);
    try {
      const res = await ApiService.claimTask(player.id, selectedGridIndex, taskPassword.trim());
      if (res.success) {
        setTaskFeedback({ text: `🎉 ${res.message}`, type: 'success' });
        onPlayerUpdate(res.player);
        setTimeout(() => {
          setTaskModalOpen(false);
        }, 2000);
      }
    } catch (err) {
      setTaskFeedback({ text: err.message || '驗證密碼失敗', type: 'error' });
    }
  };

  const getGridTaskDetails = (index) => {
    const taskConfig = tasksConfig.find(tc => Number(tc.grid_index) === index);
    if (taskConfig) {
      const rewardCard = CARDS[taskConfig.reward_card_id];
      return {
        name: taskConfig.name,
        description: taskConfig.description,
        rewardText: rewardCard ? `${rewardCard.name} (${(rewardCard.type === 'equipment' || rewardCard.type === '裝備') ? '加護' : '方劑'})` : '30 經驗值'
      };
    }
    // Fallback 靜態中草藥數據
    const fallbackRewards = {
      0: { name: '當歸', description: '辨識當歸切片，完成當歸補血湯配藥。', rewardText: '人參生脈飲 (方劑)' },
      2: { name: '甘草', description: '尋找甘草所對應的脾經穴位。', rewardText: '石膏清涼散 (方劑)' },
      4: { name: '川芎', description: '辨識川芎外觀與其氣味特色。', rewardText: '百會玉衡冠 (頭部)' },
      6: { name: '熟地', description: '觀察九蒸九曬熟地黃的製作過程。', rewardText: '斷腸五毒膏 (方劑)' },
      8: { name: '半夏', description: '學習法半夏與生半夏的炮製區別。', rewardText: '膻中氣海袍 (身體)' },
      10: { name: '陳皮', description: '體驗百草堂三年老陳皮的泡茶修煉。', rewardText: '細辛通陽鎧 (方劑)' },
      12: { name: '枸杞', description: '完成枸杞與菊花茶的搭配。', rewardText: '內關青藤腕 (雙手)' },
      14: { name: '砂仁', description: '化濕開胃！體驗砂仁研碎時的芳香。', rewardText: '靈芝補氣吸精 (方劑)' }
    };
    const defaultMedicines = ['當歸', '黃耆', '甘草', '人參', '川芎', '白芍', '熟地', '柴胡', '半夏', '茯苓', '陳皮', '白朮', '枸杞', '杜仲', '砂仁', '麥冬'];
    return fallbackRewards[index] || {
      name: defaultMedicines[index] || `藥材 #${index + 1}`,
      description: '請向百草醫館大掌櫃確認此藥櫃抽屜的採藥與辨識任務項目。',
      rewardText: '30 經驗值'
    };
  };

  // 渲染背包卡片
  const renderInventoryList = () => {
    const inv = player.inventory || {};
    const cardItems = [];

    Object.keys(inv).forEach(cardId => {
      const count = inv[cardId];
      if (count <= 0) return;
      const meta = CARDS[cardId];
      if (!meta) return;

      if (customFilter !== 'all') {
        const isMatch = (customFilter === 'equipment' && (meta.type === 'equipment' || meta.type === '裝備')) ||
                        (customFilter === 'skill' && (meta.type === 'skill' || meta.type === '技能'));
        if (!isMatch) return;
      }

      cardItems.push({ cardId, count, ...meta });
    });

    if (cardItems.length === 0) {
      return (
        <div className="col-span-full py-16 text-center text-gray-600 text-xs font-serif">
          尚無此類卡牌
        </div>
      );
    }

    return cardItems.map(card => {
      const isEquipment = card.type === 'equipment' || card.type === '裝備';
      const cardRarity = RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"];

      return (
        <div
          key={card.cardId}
          className={`game-card hover:-translate-y-1 transition duration-300 relative group overflow-hidden border ${cardRarity.border} ${cardRarity.shadow} ${isEquipment ? 'border-l-4 border-l-blue-500/30' : 'border-l-4 border-l-emerald-500/30'
            }`}
        >
          <span className="absolute top-2 right-2 bg-black/80 border border-amber-900/40 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
            x{card.count}
          </span>

          <div className="space-y-3">
            {card.image_url ? (
              <div className="w-full h-24 sm:h-32 rounded-lg overflow-hidden border border-amber-955 relative">
                <img
                  src={convertGoogleDriveUrl(card.image_url)}
                  alt={card.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  onError={(e) => {
                    e.target.src = cardPlaceholder;
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-24 sm:h-32 rounded-lg overflow-hidden border border-amber-955 relative">
                <img
                  src={cardPlaceholder}
                  alt="placeholder"
                  className="w-full h-full object-cover opacity-60"
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isEquipment ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                <h4 className={`text-xs font-black font-serif ${cardRarity.text}`}>{card.name}</h4>
              </div>
              <p className="text-[9px] uppercase tracking-widest text-amber-700 font-mono mt-0.5 font-bold">
                {isEquipment ? `裝備 • ${card.sub_type}` : '技能卡'} • {card.rarity}
              </p>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed min-h-[30px] font-serif">{card.description}</p>
          </div>

          <div className="border-t border-amber-900/30 pt-3 mt-3 grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
            <div className={card.atk_mod > 0 ? 'text-amber-500 font-bold' : card.atk_mod < 0 ? 'text-rose-400' : 'text-gray-600'}>
              內功 {card.atk_mod > 0 ? `+${card.atk_mod}` : card.atk_mod || 0}
            </div>
            <div className={card.def_mod > 0 ? 'text-blue-400 font-bold' : card.def_mod < 0 ? 'text-rose-400' : 'text-gray-600'}>
              衛氣 {card.def_mod > 0 ? `+${card.def_mod}` : card.def_mod || 0}
            </div>
            <div className={card.hp_mod > 0 ? 'text-emerald-400 font-bold' : card.hp_mod < 0 ? 'text-rose-400' : 'text-gray-600'}>
              營血 {card.hp_mod > 0 ? `+${card.hp_mod}` : card.hp_mod || 0}
            </div>
          </div>
        </div>
      );
    });
  };

  // 計算任務完成進度與連線
  const calculateBingoInfo = () => {
    const tasks = player.tasks_progress || {};

    // 16 個格子是否完成的陣列 (0 到 15)
    const completedGrids = Array.from({ length: 16 }).map((_, index) => {
      const task = tasks[String(index)];
      return task ? (task.status === 'completed' || task.completed) : false;
    });

    const completedCount = completedGrids.filter(Boolean).length;
    const progressPct = Math.round((completedCount / 16) * 100) || 0;

    const lines = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15], // 橫
      [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15], // 直
      [0, 5, 10, 15], [3, 6, 9, 12] // 斜
    ];

    let lineCount = 0;
    lines.forEach(combination => {
      if (combination.every(idx => completedGrids[idx])) {
        lineCount++;
      }
    });

    return { completedCount, progressPct, lineCount };
  };

  const { completedCount, progressPct, lineCount } = calculateBingoInfo();

  return (
    <div className="space-y-6 flex flex-col items-center">

      {/* 兌換藥貼按鈕（置中） */}
      <div className="w-full flex justify-center" style={{ marginBottom: '16px' }}>
        <button
          id="btn-claim-qr"
          onClick={() => setScannerOpen(true)}
          className="btn-neon py-2.5 px-6 text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ height: '36px', boxSizing: 'border-box' }}
        >
          <QrCode size={14} />
          掃描QR Code
        </button>
      </div>

      {/* 16 宮格藥斗挑戰櫃 (Table 表格排版) */}
      <div className="w-full flex justify-center">
        <div className="tcm-bingo-grid-wrapper">
          <table className="tcm-bingo-table">
            <tbody>
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: 4 }).map((_, colIndex) => {
                    const index = rowIndex * 4 + colIndex;
                    const tasks = player.tasks_progress || {};
                    const task = tasks[String(index)] || { status: 'available', completed: false };
                    const details = getGridTaskDetails(index);

                    let drawerClass = 'tcm-drawer-cell';
                    let isCompleted = task.status === 'completed' || task.completed;
                    let isActive = task.status === 'active';

                    if (isActive) {
                      drawerClass += ' active';
                    } else if (isCompleted) {
                      drawerClass += ' completed';
                    }

                    return (
                      <td key={colIndex}>
                        <button
                          onClick={() => handleGridClick(index)}
                          className={drawerClass}
                        >
                          <span className="text-[9px] sm:text-[10px] font-black tracking-tight block max-w-full truncate px-0.5 font-serif text-amber-100">
                            {details.name}
                          </span>

                          {isCompleted && (
                            <div className="tcm-seal-mark">
                              完成
                            </div>
                          )}

                          {isActive && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 任務完成統計區 */}
      <div className="w-full max-w-[360px] space-y-3 mx-auto">
        {/* 任務完成進度 */}
        <div className="tcm-task-info-card">
          <div className="flex justify-between text-xs font-bold text-gray-300 font-serif mb-1.5">
            <span>小任務完成進度</span>
            <span>{completedCount} / 16 斗 ({progressPct}%)</span>
          </div>
          <div className="w-full h-2 bg-black/60 border border-amber-900/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
        </div>

        {/* 連線數量 */}
        <div className="tcm-task-info-card flex justify-between items-center py-3">
          <span className="text-xs font-bold text-gray-300 font-serif">連線數量</span>
          <span className="text-xs font-black text-amber-400 font-serif">
            已達成 {lineCount} 條連線
          </span>
        </div>
      </div>

      {/* ==================== 彈窗 1：宮格任務執行與密碼驗證彈窗 ==================== */}
      {taskModalOpen && selectedGridIndex !== null && createPortal(
        <div className="tcm-task-modal-overlay">
          <div className="tcm-task-modal-content">
            <button
              onClick={() => setTaskModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            {/* 1. 標題 */}
            <div className="space-y-1 w-full text-center">
              <h3 className="text-xl font-black text-amber-400 font-serif">
                小任務：【{getGridTaskDetails(selectedGridIndex).name}】
              </h3>
            </div>

            {/* 2. 說明 */}
            <div className="w-full p-4 bg-black/45 border border-amber-950/40 rounded-xl text-center">
              <p className="text-sm font-serif text-gray-200 leading-relaxed">
                {getGridTaskDetails(selectedGridIndex).description}
              </p>
            </div>

            {taskFeedback && (
              <div className={`w-full p-2.5 text-[11px] rounded border font-serif text-center ${taskFeedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/20 text-rose-300'
                }`}>
                {taskFeedback.text}
              </div>
            )}

            {/* 3. 通關碼輸入 */}
            <div className="w-full pt-2">
              {player.tasks_progress?.[String(selectedGridIndex)]?.status === 'completed' ? (
                /* 若已完成 */
                <div className="w-full py-2 flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} className="text-amber-500 mx-auto animate-pulse" />
                  <p className="text-xs text-amber-600/80 font-serif font-bold">小任務已完成</p>
                </div>
              ) : (
                /* 未完成狀態下，不論是 active 還是 available，一律直接顯示口令驗證框，且輸入框與按鈕左右並排，高度對齊並有間隔 */
                <form onSubmit={handleClaimTask} className="w-full flex gap-4 items-center justify-center">
                  <input
                    type="text"
                    required
                    value={taskPassword}
                    onChange={(e) => setTaskPassword(e.target.value)}
                    placeholder="請輸入通關口令"
                    className="flex-1 px-4 bg-black/60 border border-amber-950 rounded-lg text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 text-center h-10"
                    style={{ height: '40px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="submit"
                    className="btn-neon px-5 text-xs font-bold whitespace-nowrap rounded-lg h-10"
                    style={{ height: '40px', boxSizing: 'border-box', margin: 0 }}
                  >
                    驗證任務
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== 彈窗 2：掃碼兌換與手動輸入彈窗 ==================== */}
      {scannerOpen && createPortal(
        <div className="tcm-task-modal-overlay">
          <div className="w-full max-w-sm glass-panel glass-panel-neon p-6 space-y-5 relative border-2 border-amber-800/40">
            <button
              onClick={() => setScannerOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 z-10"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-gray-200 font-serif">
                卡片兌換
              </h3>
              <p className="text-[9px] text-amber-700 uppercase tracking-widest font-mono font-bold">
                Scan QR Code or Insert Token
              </p>
            </div>

            {/* 訊息回饋 */}
            {scanError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[10px] rounded font-mono text-center">
                {scanError}
              </div>
            )}
            {scanSuccess && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-[10px] rounded font-mono text-center">
                {scanSuccess}
              </div>
            )}

            {/* 影像掃描區 */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-amber-950 flex items-center justify-center">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                playsInline
              ></video>
              {!isCameraActive && (
                <div className="text-center text-gray-600 space-y-1 p-4">
                  <CameraOff size={24} className="mx-auto opacity-50 text-amber-600" />
                  <p className="text-[10px] font-serif">相機未啟用</p>
                </div>
              )}
              {isCameraActive && (
                <div className="absolute inset-4 border-2 border-dashed border-amber-500/40 rounded pointer-events-none animate-pulse"></div>
              )}
            </div>

            {/* 手動輸入代碼 */}
            <form onSubmit={handleManualClaim} className="space-y-2.5 pt-2 w-full text-center flex flex-col items-center">
              <div className="space-y-1.5 w-full max-w-[280px]">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block text-center">
                  手動輸入兌換代碼
                </label>
                <div className="flex gap-2 justify-center w-full">
                  <input
                    type="text"
                    required
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="例如: QR_0000000000000_000"
                    className="flex-1 px-3 py-2 bg-black/60 border border-amber-950 rounded text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 text-center"
                  />
                  <button
                    type="submit"
                    className="btn-neon px-4 py-2 text-xs font-bold whitespace-nowrap"
                  >
                    兌換
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* 獲得獎勵浮動彈窗 */}
      {rewardMessage && createPortal(
        <div className="tcm-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-panel tcm-claim-result-card p-4 text-center border-2 border-amber-500/40 relative animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-200 font-serif">
                🎉 獲得獎勵卡片
              </h3>
              <p className="text-[8px] text-amber-700 uppercase tracking-widest font-mono font-bold">
                New Reward Card Added
              </p>
              <div className="py-1.5 px-2 bg-black/40 border border-amber-955/40 rounded-lg max-h-[60px] overflow-y-auto">
                <p className="text-[10px] text-amber-100 font-serif leading-relaxed">
                  {rewardMessage}
                </p>
              </div>
            </div>

            {/* 卡片圖示與詳情顯示 */}
            {(() => {
              const rewardCards = detectRewardCards(rewardMessage);
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

            <button
              onClick={() => setRewardMessage('')}
              className="btn-neon w-full py-1.5 text-xs font-bold font-serif mt-1"
            >
              收下獎勵
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
