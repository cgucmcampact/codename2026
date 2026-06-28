import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CARDS, RARITY_COLORS, detectRewardCards, convertGoogleDriveUrl } from '../services/cardData';
import { ApiService } from '../services/api';
import { Sparkles, Trash2, Plus, ShieldAlert, Award, ChevronLeft, ChevronRight, QrCode, Camera, CameraOff, X, Info, Leaf } from 'lucide-react';
import cardPlaceholder from '../assets/card_placeholder.png';

export default function SkillsTab({ player, onPlayerUpdate }) {
  const [deck, setDeck] = useState(Array(10).fill(""));
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCardDetail, setActiveCardDetail] = useState(null);

  // 掃碼與兌換狀態
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

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

  useEffect(() => {
    if (player && player.deck) {
      const initialDeck = [...player.deck];
      while (initialDeck.length < 10) {
        initialDeck.push("");
      }
      setDeck(initialDeck);
    }
  }, [player]);

  const getDeckCardCounts = () => {
    const counts = {};
    deck.forEach(id => {
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  };

  const handleRemoveFromSlot = (slotIdx) => {
    setError('');
    setSuccess('');
    setDeck(prev => {
      const next = [...prev];
      next[slotIdx] = "";
      return next;
    });
  };

  const handleAddToSlot = (slotIdx, cardId) => {
    setError('');
    setSuccess('');

    const currentCounts = getDeckCardCounts();
    const currentQtyInDeck = currentCounts[cardId] || 0;
    const inventoryQty = player.inventory[cardId] || 0;

    if (currentQtyInDeck >= 1) {
      setError('牌組中同一技能只能攜帶一張！');
      return;
    }

    if (currentQtyInDeck >= inventoryQty) {
      setError('已無此技能可加入出戰！');
      return;
    }

    setDeck(prev => {
      const next = [...prev];
      next[slotIdx] = cardId;
      return next;
    });
  };

  const handleSaveDeck = async () => {
    setError('');
    setSuccess('');

    // 驗證不重複
    const uniqueCards = {};
    for (let cid of deck) {
      if (cid === "") continue;
      if (uniqueCards[cid]) {
        setError('牌組中同一技能只能攜帶一張！');
        return;
      }
      uniqueCards[cid] = true;
    }

    setLoading(true);
    try {
      const res = await ApiService.updateDeck(player.id, deck); // 傳送完整的 deck，包含空字串
      if (res.success) {
        setSuccess('出戰技能儲存成功！');
        onPlayerUpdate(res.player);
      }
    } catch (err) {
      setError(err.message || '儲存技能失敗');
    } finally {
      setLoading(false);
    }
  };

  const getInventorySkills = () => {
    const deckCounts = getDeckCardCounts();
    return Object.keys(player.inventory || {})
      .map(id => ({ id, ...CARDS[id], totalCount: player.inventory[id] }))
      .filter(card => card.type === 'skill' || card.type === '技能')
      .map(card => {
        const inDeckCount = deckCounts[card.id] || 0;
        return {
          ...card,
          availableCount: card.totalCount - inDeckCount
        };
      });
  };

  const inventorySkills = getInventorySkills();
  const deckCounts = getDeckCardCounts();

  const handlePrev = () => {
    setSliderIndex((prev) => (prev === 0 ? inventorySkills.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSliderIndex((prev) => (prev === inventorySkills.length - 1 ? 0 : prev + 1));
  };

  const currentCard = inventorySkills[sliderIndex];

  // 渲染單個技能槽卡片
  const getSlotRender = (slotIdx) => {
    const cardId = deck[slotIdx];
    const card = cardId ? CARDS[cardId] : null;
    const isActive = activeSlotIndex === slotIdx;
    const cardRarity = card ? (RARITY_COLORS[card.rarity] || RARITY_COLORS["綠色"]) : null;

    return (
      <div
        onClick={() => {
          setActiveSlotIndex(slotIdx);
        }}
        className={`tcm-skill-slot ${isActive ? 'active' : ''} ${!card ? 'empty-slot' : ''} ${card ? cardRarity.border : ''}`}
      >
        <span className="tcm-skill-slot-index z-10">{slotIdx + 1}</span>
        {card ? (
          <>
            {card.image_url ? (
              <img
                src={convertGoogleDriveUrl(card.image_url)}
                alt={card.name}
                className="absolute inset-0 w-full h-full object-cover flex-shrink-0"
                style={{ borderRadius: '7px', zIndex: 0 }}
                onError={(e) => {
                  e.target.src = cardPlaceholder;
                }}
              />
            ) : (
              <span className={`tcm-skill-slot-name ${cardRarity.text}`}>{card.name}</span>
            )}
            <button
              id={`btn-remove-skill-slot-${slotIdx}`}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromSlot(slotIdx);
              }}
              className="tcm-skill-slot-remove z-10"
              title="移出技能"
            >
              <Trash2 size={8} />
            </button>
          </>
        ) : (
          <Plus size={14} />
        )}
      </div>
    );
  };

  return (
    <div className="tcm-skills-container">
      {/* 頁面標題與儲存按鈕區 */}
      <div className="w-full flex flex-col gap-4" style={{ marginBottom: '8px' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2 font-serif">
              <Sparkles size={20} className="text-amber-500" />
              出戰技能設定
            </h2>
            <p className="text-xs text-gray-400 mt-1">選定最多 10 個技能。</p>
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-end">
            {(() => {
              const isDeckUnchanged = player && player.deck && deck.every((id, idx) => id === (player.deck[idx] || ""));
              const hasConfiguredCards = deck.filter(id => id !== "").length > 0;
              return (
                <>
                  <div className="text-sm font-serif">
                    已選技能數:{' '}
                    <span className={`font-mono font-bold ${hasConfiguredCards ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {deck.filter(id => id !== "").length} / 10
                    </span>
                  </div>
                  <button
                    id="btn-save-deck"
                    disabled={loading || isDeckUnchanged}
                    onClick={handleSaveDeck}
                    className={`btn-neon py-2 px-4 text-xs font-bold ${isDeckUnchanged ? 'btn-disabled' : ''}`}
                  >
                    {loading ? '正在備戰中...' : '儲存出戰技能'}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full max-w-[340px] p-3 bg-rose-955/40 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-center gap-2 font-serif animate-shake" style={{ marginBottom: '16px' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="w-full max-w-[340px] p-3 bg-emerald-955/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg flex items-center gap-2 font-serif" style={{ marginBottom: '16px' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>{success}</span>
        </div>
      )}

      {/* 掃描 QR Code 按鈕 (置中，在網格上方) */}
      <div className="w-full flex justify-center" style={{ marginBottom: '16px' }}>
        <button
          id="btn-skills-claim-qr"
          onClick={() => setScannerOpen(true)}
          className="btn-neon py-2 px-6 text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ height: '36px', boxSizing: 'border-box' }}
        >
          <QrCode size={14} />
          掃描QR Code
        </button>
      </div>

      {/* 1. 上方：10 個技能槽 (4-2-4 環狀 HTML <table>) */}
      <h3 className="w-full max-w-[340px] text-xs font-bold text-gray-300 mb-3 flex items-center gap-1.5 font-serif align-left">
        <Award size={15} className="text-amber-500" />
        已配出戰技能
      </h3>

      <table className="tcm-skills-table">
        <tbody>
          <tr>
            <td>{getSlotRender(0)}</td>
            <td>{getSlotRender(1)}</td>
            <td>{getSlotRender(2)}</td>
            <td>{getSlotRender(3)}</td>
          </tr>
          <tr>
            <td>{getSlotRender(4)}</td>
            <td colSpan="2" className="tcm-table-empty-cell"></td>
            <td>{getSlotRender(5)}</td>
          </tr>
          <tr>
            <td>{getSlotRender(6)}</td>
            <td>{getSlotRender(7)}</td>
            <td>{getSlotRender(8)}</td>
            <td>{getSlotRender(9)}</td>
          </tr>
        </tbody>
      </table>

      {/* 2. 下方：Slider/Carousel 庫存方劑輪播 */}
      <div className="w-full max-w-[340px] mx-auto" style={{ marginTop: '8px' }}>
        <h3 className="text-[10px] font-bold text-gray-400 font-serif border-b border-amber-900/20 pb-1.5 flex justify-center items-center gap-3 px-1" style={{ marginBottom: '12px' }}>
          <span>技能清單</span>
          {inventorySkills.length > 0 && (
            <span className="text-[9px] text-gray-500 font-mono">
              擁有 {inventorySkills.length} 個技能 ({sliderIndex + 1}/{inventorySkills.length})
            </span>
          )}
        </h3>

        {inventorySkills.length === 0 ? (
          <div className="py-10 text-center text-gray-600 text-xs font-serif border border-dashed border-amber-955/30 rounded-xl bg-black/10">
            尚未獲得任何可用技能
          </div>
        ) : (
          <div className="w-full flex flex-col">
            {/* 左右按鈕與卡片 */}
            <div className="tcm-gear-carousel-container">
              {/* 左切換鍵 */}
              <button
                onClick={handlePrev}
                disabled={inventorySkills.length <= 1}
                className="tcm-carousel-nav-btn"
              >
                <ChevronLeft size={16} />
              </button>

              {/* 裝備詳情卡片 (暗木色背景，亮米白字) */}
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
                        存餘: {currentCard.availableCount} / {currentCard.totalCount}
                      </span>
                    </div>

                    {/* 技能卡主體 - 直立長方形圖片 */}
                    <div
                      className={`rounded-lg overflow-hidden border-2 ${cardRarity.border} ${cardRarity.shadow} bg-black/40 shrink-0 my-2`}
                      style={{ width: '110px', height: '157px', position: 'relative' }}
                    >
                      {/* 技能圖片鋪滿與 Fallback Leaf 圖示 */}
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                        {currentCard.image_url ? (
                          <img
                            key={currentCard.id}
                            src={convertGoogleDriveUrl(currentCard.image_url)}
                            alt={currentCard.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = cardPlaceholder;
                            }}
                          />
                        ) : (
                          <img
                            src={cardPlaceholder}
                            alt="placeholder"
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                          />
                        )}
                      </div>
                    </div>

                    {/* 卡牌名稱 - 作為獨立元素 */}
                    <h4 className="card-title my-1">
                      {currentCard.name}
                    </h4>

                    <div className="card-desc">
                      {currentCard.description}
                    </div>

                    <div className="card-stats">
                      <span className="card-stat-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'inherit' }}>
                        {currentCard.rarity}
                      </span>
                      {currentCard.hp_mod !== 0 && (
                        <span className="card-stat-badge hp" style={{ background: 'rgba(82, 183, 136, 0.15)', color: '#52b788' }}>
                          營血 {currentCard.hp_mod > 0 ? `+${currentCard.hp_mod}` : currentCard.hp_mod}
                        </span>
                      )}
                      {currentCard.atk_mod !== 0 && (
                        <span className="card-stat-badge atk" style={{ background: 'rgba(242, 92, 84, 0.15)', color: '#f25c54' }}>
                          內功 {currentCard.atk_mod > 0 ? `+${currentCard.atk_mod}` : currentCard.atk_mod}
                        </span>
                      )}
                      {currentCard.def_mod !== 0 && (
                        <span className="card-stat-badge def" style={{ background: 'rgba(72, 149, 239, 0.15)', color: '#4895ef' }}>
                          衛氣 {currentCard.def_mod > 0 ? `+${currentCard.def_mod}` : currentCard.def_mod}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 右切換鍵 */}
              <button
                onClick={handleNext}
                disabled={inventorySkills.length <= 1}
                className="tcm-carousel-nav-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 加入出戰 / 移出出戰 動作按鈕 */}
            <div className="tcm-action-button-container">
              {(() => {
                const isCardInCurrentSlot = deck[activeSlotIndex] === currentCard.id;
                if (isCardInCurrentSlot) {
                  return (
                    <button
                      id={`btn-slot-remove-${currentCard.id}`}
                      onClick={() => handleRemoveFromSlot(activeSlotIndex)}
                      className="tcm-action-btn unequip-action"
                    >
                      移出此槽
                    </button>
                  );
                }

                const isCardInOtherSlot = deck.includes(currentCard.id);
                if (isCardInOtherSlot) {
                  return (
                    <button
                      disabled
                      className="tcm-action-btn equip-action opacity-50 cursor-not-allowed"
                      style={{ background: '#332211', color: '#887766', border: '1px solid #554433' }}
                    >
                      已在出戰中
                    </button>
                  );
                }

                const hasStock = currentCard.availableCount > 0;
                return (
                  <button
                    id={`btn-slot-add-${currentCard.id}`}
                    disabled={!hasStock || deck.filter(id => id !== "").length >= 10 && !deck[activeSlotIndex]}
                    onClick={() => handleAddToSlot(activeSlotIndex, currentCard.id)}
                    className="tcm-action-btn equip-action"
                  >
                    {!hasStock ? '已配滿' : '加入此槽'}
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
                卡片兌換
              </h3>
              <p className="text-[9px] text-amber-700 uppercase tracking-widest font-mono font-bold">
                Scan QR code or Type in Token
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
                    placeholder="例如: QR_0000000000000_000"
                    className="flex-1 px-3 py-2 bg-black/60 border border-amber-950 rounded text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="btn-neon px-4 py-2 text-xs font-bold"
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

              <div className="tcm-card-detail-img-wrapper">
                <img
                  src={activeCardDetail.image_url ? convertGoogleDriveUrl(activeCardDetail.image_url) : cardPlaceholder}
                  alt={activeCardDetail.name}
                  onError={(e) => {
                    e.target.src = cardPlaceholder;
                  }}
                />
              </div>

              <div className="tcm-card-detail-desc">
                {activeCardDetail.description}
              </div>

              <div className="tcm-card-detail-grid">
                <div className="tcm-card-detail-item">
                  <span className="tcm-card-detail-label">類型</span>
                  <span className="tcm-card-detail-value">{(activeCardDetail.type === 'equipment' || activeCardDetail.type === '裝備') ? '裝備' : '技能'}</span>
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
                  <span className="tcm-card-detail-label">作用</span>
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
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setActiveCardDetail(null)}
                  className="btn-neon px-6 py-1.5 text-xs font-bold"
                >
                  關閉
                </button>
              </div>
              <div className="tcm-card-detail-close-tip mt-2">
                (點擊任意空白處或此按鈕即可關閉)
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* 獲得獎勵浮動彈窗 */}
      {rewardMessage && createPortal(
        <div className="tcm-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-panel tcm-claim-result-card p-4 text-center border-2 border-amber-500/40 relative animate-scaleUp" onClick={e => e.stopPropagation()}>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-200 font-serif">
                🎉 獲得獎勵卡片
              </h3>
              <p className="text-[8px] text-amber-700 uppercase tracking-widest font-mono font-bold">
                Bonus Card Acquired
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
