import React from 'react';
import { calculateStats, getExpNeededForNextLevel } from '../services/cardData';
import { Shield, Swords, Heart, Award } from 'lucide-react';

export default function PlayerHUD({ player }) {
  // 根據等級與裝備計算最終數值
  const stats = calculateStats(player);
  const expNeeded = getExpNeededForNextLevel(stats.level);
  const expPct = Math.min(100, Math.floor((stats.exp % 100) / expNeeded * 100) || 0);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'game_admin': return '醫館大掌櫃';
      case 'admin': return '分藥總管';
      default: return null;
    }
  };

  return (
    <div className="tcm-hud-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
      {/* 上半部：大頭照與個人基本資料 */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
        {/* 左側：大頭照（照片） */}
        <div className="tcm-hud-avatar-col" style={{ flexShrink: 0 }}>
          <div className="tcm-hud-avatar-ring">
            <span className="tcm-hud-avatar-text">{player.name ? player.name[0] : 'P'}</span>
            <div className="tcm-hud-level-badge">Lv.{stats.level}</div>
          </div>
        </div>

        {/* 右側：個人基本資料 (姓名、ID、身分勳章、經驗條) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch', textAlign: 'left' }}>
          <h2 className="tcm-hud-name" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-paper)', fontFamily: "'Noto Serif TC', serif" }}>{player.name}</h2>
          <p className="tcm-hud-id" style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>ID: {player.id}</p>
          
          {getRoleBadge(player.role) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px', marginBottom: '2px' }}>
              <span className="tcm-hud-role-badge">
                {getRoleBadge(player.role)}
              </span>
            </div>
          )}
          
          {/* 經驗值條 */}
          <div className="tcm-hud-exp-container">
            <div className="tcm-hud-exp-text">
              <span>升級經驗 (EXP)</span>
              <span>{stats.exp % 100} / {expNeeded}</span>
            </div>
            <div className="tcm-hud-exp-track">
              <div 
                id="hud-exp-bar"
                className="tcm-hud-exp-fill"
                style={{ width: `${expPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 下半部：屬性排版：營血, 衛氣, 內功, 歷練 (精美 2x2 網格) */}
      <div className="tcm-hud-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', width: '100%' }}>
        {/* 營血 */}
        <div className="tcm-hud-stat-card hp" id="hud-stat-hp" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(82, 183, 136, 0.3)' }}>
          <Heart size={15} fill="currentColor" fillOpacity={0.2} style={{ color: '#52b788', flexShrink: 0 }} />
          <div className="stat-card-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
            <span className="stat-card-label" style={{ fontSize: '9px', opacity: 0.6, color: '#52b788', letterSpacing: '0.05em' }}>營血 (生命)</span>
            <span className="stat-card-val" style={{ fontSize: '13px', fontWeight: 'bold', color: '#52b788' }}>{stats.maxHp}</span>
          </div>
        </div>
        {/* 衛氣 */}
        <div className="tcm-hud-stat-card def" id="hud-stat-def" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(72, 149, 239, 0.3)' }}>
          <Shield size={15} style={{ color: '#4895ef', flexShrink: 0 }} />
          <div className="stat-card-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
            <span className="stat-card-label" style={{ fontSize: '9px', opacity: 0.6, color: '#4895ef', letterSpacing: '0.05em' }}>衛氣 (防禦)</span>
            <span className="stat-card-val" style={{ fontSize: '13px', fontWeight: 'bold', color: '#4895ef' }}>{stats.def}</span>
          </div>
        </div>
        {/* 內功 */}
        <div className="tcm-hud-stat-card atk" id="hud-stat-atk" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(242, 92, 84, 0.3)' }}>
          <Swords size={15} style={{ color: '#f25c54', flexShrink: 0 }} />
          <div className="stat-card-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
            <span className="stat-card-label" style={{ fontSize: '9px', opacity: 0.6, color: '#f25c54', letterSpacing: '0.05em' }}>內功 (攻擊)</span>
            <span className="stat-card-val" style={{ fontSize: '13px', fontWeight: 'bold', color: '#f25c54' }}>{stats.atk}</span>
          </div>
        </div>
        {/* 歷練 */}
        <div className="tcm-hud-stat-card exp" id="hud-stat-exp" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(244, 162, 97, 0.3)' }}>
          <Award size={15} style={{ color: '#f4a261', flexShrink: 0 }} />
          <div className="stat-card-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
            <span className="stat-card-label" style={{ fontSize: '9px', opacity: 0.6, color: '#f4a261', letterSpacing: '0.05em' }}>歷練 (總額)</span>
            <span className="stat-card-val" style={{ fontSize: '13px', fontWeight: 'bold', color: '#f4a261' }}>{stats.exp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
