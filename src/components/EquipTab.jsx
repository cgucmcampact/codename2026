import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CARDS, RARITY_COLORS } from '../services/cardData';
import { ApiService } from '../services/api';
import { 
  ShieldAlert, Plus, X, QrCode, Camera, CameraOff, 
  ChevronLeft, ChevronRight, CheckCircle2, Info 
} from 'lucide-react';
import gorillaBeast from '../assets/gorilla_beast.png';

// 8個裝備孔位在 340x340 畫布上的百分比坐標，精確對齊右側設計圖
const SLOT_RENDER_CONFIG = [
  { slot: 'sub1', label: '輔助一', subType: 'sub', style: { top: '77%', left: '74%' } },
  { slot: 'sub2', label: '輔助二', subType: 'sub', style: { top: '77%', left: '88%' } },
  { slot: 'head', label: '頭部', subType: 'head', style: { top: '10%', left: '55%' } },
  { slot: 'hands', label: '左手', subType: 'hands', style: { top: '23%', left: '90%' } },
  { slot: 'hands', label: '右手', subType: 'hands', style: { top: '8%', left: '8%' } },
  { slot: 'body', label: '腹部', subType: 'body', style: { top: '40%', left: '45%' } },
  { slot: 'feet', label: '左腳', subType: 'feet', style: { top: '77%', left: '23%' } },
  { slot: 'feet', label: '右腳', subType: 'feet', style: { top: '91%', left: '50%' } }
];

const SLOT_TAB_MAP = {
  head: 'head',
  body: 'body',
  hands: 'hands',
  feet: 'feet',
  sub1: 'sub',
  sub2: 'sub'
};

const TAB_LABELS = {
  all: '全部',
  head: '頭部',
  hands: '手部',
  feet: '腳部',
  body: '腹部',
  sub: '其他'
};

export default function EquipTab({ player, onPlayerUpdate }) {
  const [activeSlot, setActiveSlot] = useState(null);
  const [selectedFilterTab, setSelectedFilterTab] = useState('all');
  const [sliderIndex, setSliderIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCardDetail, setActiveCardDetail] = useState(null);

  // 掃碼與兌換狀態
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // 動態加載 jsQR CDN
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 當打開/關閉掃描儀時，觸發相機控制
  useEffect(() => {
    if (scannerOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scannerOpen]);

  async function startCamera() {
    setScanError('');
    setScanSuccess('');
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
      setScanError('無法啟用相機，請檢查權限或改用手動輸入兌換。');
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
        alert(res.message || '兌換成功！');
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
        alert(res.message || '兌換成功！');
        setManualToken('');
        onPlayerUpdate(res.player);
      }
    } catch (err) {
      setScanError(err.message || '兌換失敗');
    }
  }

  // 取得目前所有已裝備的卡牌 ID 統計
  const getEquippedCounts = (currentEquipped) => {
    const counts = {};
    Object.values(currentEquipped).forEach(id => {
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  };

  // 卸下裝備
  const handleUnequip = async (slot) => {
    setError('');
    setLoading(true);
    const nextEquipped = { ...player.equipped };
    nextEquipped[slot] = "";

    try {
      const res = await ApiService.updateEquipment(player.id, nextEquipped);
      if (res.success) {
        onPlayerUpdate(res.player);
      }
    } catch (err) {
      setError(err.message || '卸下加護失敗');
    } finally {
      setLoading(false);
    }
  };

  // 裝備卡牌
  const handleEquip = async (slot, cardId) => {
    setError('');
    setLoading(true);
    const nextEquipped = { ...player.equipped };
    nextEquipped[slot] = cardId;

    try {
      const res = await ApiService.updateEquipment(player.id, nextEquipped);
      if (res.success) {
        onPlayerUpdate(res.player);
        setActiveSlot(null);
      }
    } catch (err) {
      setError(err.message || '裝備加護失敗');
    } finally {
      setLoading(false);
    }
  };

  // 點擊插槽
  const handleSlotClick = (slot) => {
    if (activeSlot === slot) {
      setActiveSlot(null);
    } else {
      setActiveSlot(slot);
      const mappedTab = SLOT_TAB_MAP[slot];
      if (mappedTab) {
        setSelectedFilterTab(mappedTab);
        setSliderIndex(0); // 切換插槽時，自動將輪播卡片重設至第一張
      }
    }
  };

  // 自動或點擊「選用」時裝備
  const handleAutoEquip = (card) => {
    if (activeSlot) {
      const targetSubtype = SLOT_RENDER_CONFIG.find(c => c.slot === activeSlot)?.subType;
      if (targetSubtype === card.sub_type) {
        handleEquip(activeSlot, card.id);
        return;
      }
    }

    if (card.sub_type === 'head') {
      handleEquip('head', card.id);
    } else if (card.sub_type === 'body') {
      handleEquip('body', card.id);
    } else if (card.sub_type === 'hands') {
      handleEquip('hands', card.id);
    } else if (card.sub_type === 'feet') {
      handleEquip('feet', card.id);
    } else if (card.sub_type === 'sub') {
      if (!player.equipped?.sub1) {
        handleEquip('sub1', card.id);
      } else if (!player.equipped?.sub2) {
        handleEquip('sub2', card.id);
      } else {
        handleEquip('sub1', card.id);
      }
    }
  };

  // 篩選出背包中擁有的裝備卡牌
  const getInventoryGear = () => {
    return Object.keys(player.inventory || {})
      .map(id => ({ id, ...CARDS[id], count: player.inventory[id] }))
      .filter(card => {
        if (card.type !== 'equipment') return false;
        if (selectedFilterTab !== 'all') {
          if (selectedFilterTab === 'sub') {
            if (card.sub_type !== 'sub') return false;
          } else {
            if (card.sub_type !== selectedFilterTab) return false;
          }
        }
        return true;
      });
  };

  const gearItems = getInventoryGear();
  const equippedCounts = getEquippedCounts(player.equipped || {});

  const handlePrev = () => {
    setSliderIndex((prev) => (prev === 0 ? gearItems.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSliderIndex((prev) => (prev === gearItems.length - 1 ? 0 : prev + 1));
  };

  const currentCard = gearItems[sliderIndex];

  // 兩排分類頁簽 (4+2)
  const filterRow1 = ['all', 'head', 'hands', 'feet'];
  const filterRow2 = ['body', 'sub'];

  return (
    <div className="tcm-equip-tab-container">
      {error && (
        <div className="w-full max-w-[340px] text-xs text-red-400 bg-red-950/40 border border-red-500/20 px-3 py-2 rounded flex items-center justify-center gap-1.5 font-serif animate-shake">
          <ShieldAlert size={14} />
          {error}
        </div>
      )}

      {/* 掃描 QR Code 按鈕 (獨立在最頂部，有合適邊隔) */}
      <div className="w-full flex justify-center pb-1">
        <button
          id="btn-equip-claim-qr"
          onClick={() => setScannerOpen(true)}
          className="btn-neon py-2 px-6 text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ height: '36px', boxSizing: 'border-box' }}
        >
          <QrCode size={14} />
          掃描QR Code
        </button>
      </div>

      {/* 1. 畫面中央：靈獸剪影插槽介面容器 */}
      <div className="tcm-beast-wrapper relative">
        {/* 靈獸大猩猩剪影 (直接呈現原圖，不進行去背) */}
        <div className="tcm-beast-silhouette w-full h-full flex items-center justify-center pointer-events-none z-1">
          <img 
            src={gorillaBeast} 
            className="w-[84%] h-[84%] object-contain"
            alt="靈獸" 
          />
        </div>

        {SLOT_RENDER_CONFIG.map((cfg, idx) => {
          const { slot, label, style } = cfg;
          const cardId = player.equipped?.[slot];
          const card = cardId ? CARDS[cardId] : null;
          const isActive = activeSlot === slot;
          const cardRarity = card ? (RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"]) : null;

          return (
            <div
              key={idx}
              className={`tcm-beast-slot ${isActive ? 'active' : ''} ${!card ? 'empty-slot' : ''} ${card ? cardRarity.border : ''}`}
              style={style}
            >
              {card ? (
                <>
                  <button
                    onClick={() => handleSlotClick(slot)}
                    className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-amber-955/40 border-none p-0 cursor-pointer relative"
                    title={`${label}: ${card.name}`}
                  >
                    <span className="tcm-beast-slot-fallback absolute">{card.name.slice(0, 2)}</span>
                    {card.image_url && (
                      <img 
                        src={card.image_url} 
                        alt={card.name} 
                        className="tcm-beast-slot-image absolute inset-0 w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                  </button>
                  <button
                    id={`btn-unequip-badge-${slot}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnequip(slot);
                    }}
                    className="tcm-beast-slot-remove"
                    title="卸下加護"
                  >
                    <X size={10} />
                  </button>
                </>
              ) : (
                <button
                  id={`btn-equip-trigger-${slot}-${idx}`}
                  onClick={() => handleSlotClick(slot)}
                  className="w-full h-full rounded-full flex items-center justify-center text-amber-500 bg-transparent border-none cursor-pointer p-0"
                  title={`敷藥/行針: ${label}`}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. 裝備分類頁簽 (兩排 4+2，置中) */}
      <div className="tcm-filter-container">
        {/* 第一排 4 個 */}
        <div className="tcm-filter-row">
          {filterRow1.map(tabKey => (
            <button
              key={tabKey}
              onClick={() => {
                setSelectedFilterTab(tabKey);
                setSliderIndex(0);
                setActiveSlot(null);
              }}
              className={`tcm-filter-tab-btn ${
                selectedFilterTab === tabKey ? 'active-tab' : 'inactive-tab'
              }`}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
        {/* 第二排 2 個 */}
        <div className="tcm-filter-row row-2">
          {filterRow2.map(tabKey => (
            <button
              key={tabKey}
              onClick={() => {
                setSelectedFilterTab(tabKey);
                setSliderIndex(0);
                setActiveSlot(null);
              }}
              className={`tcm-filter-tab-btn ${
                selectedFilterTab === tabKey ? 'active-tab' : 'inactive-tab'
              }`}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 下方：Slider/Carousel 裝備輪播 */}
      <div className="w-full max-w-[340px] mx-auto" style={{ marginTop: '16px' }}>
        {gearItems.length === 0 ? (
          <div className="w-full flex flex-col gap-2">
            <h3 className="text-[10px] font-bold text-gray-400 font-serif border-b border-amber-900/20 pb-1.5 flex justify-between items-center px-1">
              <span>
                {activeSlot 
                  ? `可選配加護 (對應: ${SLOT_RENDER_CONFIG.find(c => c.slot === activeSlot)?.label})`
                  : '百草囊裝備清單'
                }
              </span>
              <span className="text-[9px] text-gray-500 font-mono">
                此分類共 0 件
              </span>
            </h3>
            <div className="py-10 text-center text-gray-600 text-xs font-serif border border-dashed border-amber-955/30 rounded-xl bg-black/10">
              百草囊空空，尚無此類型的加護藥貼
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col">
            <h3 className="text-[10px] font-bold text-gray-400 font-serif border-b border-amber-900/20 pb-1.5 flex justify-between items-center px-1" style={{ marginBottom: '12px' }}>
              <span>
                {activeSlot 
                  ? `可選配加護 (對應: ${SLOT_RENDER_CONFIG.find(c => c.slot === activeSlot)?.label})`
                  : '百草囊裝備清單'
                }
              </span>
              <span className="text-[9px] text-gray-500 font-mono">
                擁有 {gearItems.length} 件 ({sliderIndex + 1}/{gearItems.length})
              </span>
            </h3>

            {/* 左右按鈕與卡片同時且在同一個水平面上顯示 */}
            <div className="tcm-gear-carousel-container">
              {/* 左切換鍵 */}
              <button
                onClick={handlePrev}
                disabled={gearItems.length <= 1}
                className="tcm-carousel-nav-btn"
              >
                <ChevronLeft size={16} />
              </button>

              {/* 裝備詳情卡片 (淡藍色背景，黑色字) */}
              {(() => {
                const cardRarity = RARITY_COLORS[currentCard.rarity] || RARITY_COLORS["綠色"];
                return (
                  <div className={`tcm-gear-detail-card border ${cardRarity.border} ${cardRarity.shadow}`}>
                    {/* 右上角 Information 標示 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCardDetail(currentCard);
                      }}
                      className="absolute top-2 right-2 z-20 p-1 rounded-full bg-black/80 text-amber-400 hover:text-amber-300 hover:bg-black transition cursor-pointer flex items-center justify-center border-none"
                      title="查看效果"
                    >
                      <Info size={11} />
                    </button>

                    <div className="flex justify-end w-full pr-6 mb-1">
                      <span className="card-stock">
                        存餘: {currentCard.count - (equippedCounts[currentCard.id] || 0)} / {currentCard.count}
                      </span>
                    </div>

                    {/* 裝備卡主體 - 圓形 + 下方重疊標籤 (符合附圖右側) */}
                    <div className="relative my-3 flex flex-col items-center select-none pb-2">
                      {/* 圓形裝備圖片 */}
                      <div 
                        className={`rounded-full overflow-hidden border-2 ${cardRarity.border} ${cardRarity.shadow} bg-black/40 flex items-center justify-center shrink-0`}
                        style={{ width: '96px', height: '96px', position: 'relative' }}
                      >
                        <span className="text-[28px] opacity-10 font-black font-serif text-amber-500 select-none">
                          {currentCard.name.slice(0, 1)}
                        </span>
                        {currentCard.image_url && (
                          <img 
                            src={currentCard.image_url} 
                            alt={currentCard.name} 
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      
                      {/* 下方稍微重疊的矩形名稱標籤 */}
                      <div className="absolute -bottom-1.5 px-3 py-0.5 bg-amber-955 border border-amber-500/40 text-amber-400 font-bold text-[10px] rounded shadow-md whitespace-nowrap text-center z-10">
                        <span className={`font-serif tracking-wider ${cardRarity.text}`}>
                          {currentCard.name}
                        </span>
                      </div>
                    </div>

                    <div className="card-desc line-clamp-2">
                      {currentCard.description}
                    </div>

                    <div className="card-stats">
                      <span className="card-stat-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'inherit' }}>
                        {currentCard.rarity}
                      </span>
                      {currentCard.atk_mod !== 0 && (
                        <span className="card-stat-badge atk" style={{ background: 'rgba(242, 92, 84, 0.15)', color: '#f25c54' }}>
                          內 {currentCard.atk_mod > 0 ? `+${currentCard.atk_mod}` : currentCard.atk_mod}
                        </span>
                      )}
                      {currentCard.def_mod !== 0 && (
                        <span className="card-stat-badge def" style={{ background: 'rgba(72, 149, 239, 0.15)', color: '#4895ef' }}>
                          衛 {currentCard.def_mod > 0 ? `+${currentCard.def_mod}` : currentCard.def_mod}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 右切換鍵 */}
              <button
                onClick={handleNext}
                disabled={gearItems.length <= 1}
                className="tcm-carousel-nav-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 選用 / 卸下 按鈕，獨立放在介紹下方且水平置中 */}
            <div className="tcm-action-button-container">
              {(() => {
                const equippedSlot = Object.keys(player.equipped || {}).find(slot => player.equipped[slot] === currentCard.id);
                if (equippedSlot) {
                  return (
                    <button
                      id={`btn-unequip-gear-${currentCard.id}`}
                      disabled={loading}
                      onClick={() => handleUnequip(equippedSlot)}
                      className="tcm-action-btn unequip-action"
                    >
                      卸下
                    </button>
                  );
                }

                const hasStock = (currentCard.count - (equippedCounts[currentCard.id] || 0)) > 0;
                return (
                  <button
                    id={`btn-use-gear-${currentCard.id}`}
                    disabled={loading || !hasStock}
                    onClick={() => handleAutoEquip(currentCard)}
                    className="tcm-action-btn equip-action"
                  >
                    {!hasStock ? '已配滿' : '選用'}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ==================== 掃碼與手動輸入彈窗 ==================== */}
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
                百草藥貼 / 香箋兌換
              </h3>
              <p className="text-[9px] text-amber-700 uppercase tracking-widest font-mono font-bold">
                Scan Aether Token or Insert Stamp Code
              </p>
            </div>

            {/* 訊息回饋 */}
            {scanError && (
              <div className="p-2.5 bg-rose-955/40 border border-rose-500/20 text-rose-300 text-[10px] rounded font-mono text-center animate-shake">
                {scanError}
              </div>
            )}
            {scanSuccess && (
              <div className="p-2.5 bg-emerald-955/40 border border-emerald-500/20 text-emerald-300 text-[10px] rounded font-mono text-center">
                {scanSuccess}
              </div>
            )}

            {/* 影像掃描區 */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-amber-955 flex items-center justify-center">
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

            {/* 手動輸入 */}
            <form onSubmit={handleManualClaim} className="space-y-2.5 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">手動輸入兌換代碼 (Token)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="例如: QR_1718000000000_123"
                    className="flex-1 px-3 py-2 bg-black/60 border border-amber-950 rounded text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="btn-neon px-4 py-2 text-xs font-bold"
                  >
                    兌藥
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ==================== 詳情彈窗 Portal (完全置中) ==================== */}
      {(() => {
        if (!activeCardDetail) return null;
        const detailRarity = RARITY_COLORS[activeCardDetail.rarity] || RARITY_COLORS["綠色"];
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
                    <span className="tcm-card-detail-label">五行</span>
                    <span className={`tcm-card-detail-value ${
                      activeCardDetail.element === '火' ? 'text-orange-400' :
                      activeCardDetail.element === '水' ? 'text-blue-400' :
                      activeCardDetail.element === '木' ? 'text-emerald-400' :
                      activeCardDetail.element === '金' ? 'text-yellow-300' :
                      activeCardDetail.element === '土' ? 'text-amber-500' : 'text-gray-400'
                    }`}>{activeCardDetail.element}</span>
                  </div>
                )}
                <div className="tcm-card-detail-item">
                  <span className="tcm-card-detail-label">目標</span>
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
              </div>
              <div className="tcm-card-detail-close-tip">
                (點擊任意空白處即可關閉)
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
