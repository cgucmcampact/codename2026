import React, { useState } from 'react';
import { ApiService } from '../services/api';
import { Shield, Key, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('請輸入帳號與密碼');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.login(username.trim(), password.trim());
      if (res.success && res.player) {
        onLoginSuccess(res.player);
      }
    } catch (err) {
      setError(err.message || '登入失敗，請確認帳密或後端部署狀態');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tcm-login-wrapper">
      
      {/* 1. 上方盒子：標題面板 */}
      <div className="glass-panel glass-panel-neon tcm-login-title-panel">
        {/* 背景裝飾微光 */}
        <div className="absolute -top-12 -left-12 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="tcm-login-title-icon">
          <Shield size={28} />
        </div>
        <h2 className="tcm-login-title-text">
          百草醫館
        </h2>
        <p className="tcm-login-subtitle-text">
          Apothecary Training Ground
        </p>
      </div>

      {/* 2. 下方盒子：帳號密碼輸入處 */}
      <div className="glass-panel glass-panel-neon tcm-login-form-panel">
        {/* 背景裝飾微光 */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <form onSubmit={handleSubmit} className="tcm-login-form">
          {error && (
            <div className="tcm-login-error">
              ⚠️ {error}
            </div>
          )}

          <div className="tcm-login-fields-container">
            {/* 帳號欄位 */}
            <div className="tcm-login-field">
              <label htmlFor="input-username" className="tcm-login-label">
                弟子 / 掌櫃 帳號
              </label>
              <div className="tcm-login-input-wrapper">
                <span className="tcm-login-input-icon">
                  <Shield size={16} />
                </span>
                <input
                  id="input-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例如: player1, player2"
                  className="tcm-login-input"
                />
              </div>
            </div>

            {/* 密碼欄位 */}
            <div className="tcm-login-field">
              <label htmlFor="input-password" className="tcm-login-label">
                通關口令 (密碼)
              </label>
              <div className="tcm-login-input-wrapper">
                <span className="tcm-login-input-icon">
                  <Key size={16} />
                </span>
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="輸入通關口令"
                  className="tcm-login-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="tcm-login-password-toggle"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="tcm-login-submit-container">
            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="btn-neon tcm-login-submit-btn"
            >
              {loading ? (
                <span className="tcm-login-spinner"></span>
              ) : (
                <>
                  <Sparkles size={14} />
                  跨入百草醫館
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
