import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
    const [teamId, setTeamId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.login(teamId, password);
            // Logic: In real GAS, we check res.ok
            // Mock returns { ok: true }
            if (res.ok) {
                localStorage.setItem('teamId', teamId);
                toast.success(`Welcome, Team ${teamId}!`);
                navigate('/dashboard');
            } else {
                toast.error('Login Failed: ' + res.error);
            }
        } catch (err) {
            toast.error('Connection Error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <h1 className="title" style={{ color: 'var(--color-warning)', textShadow: '4px 4px var(--color-primary)' }}>SPIRIT BEAST</h1>

            <div className="pixel-box" style={{ width: '100%', maxWidth: '400px' }}>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>TEAM ID</label>
                        <input
                            type="text"
                            value={teamId}
                            onChange={e => setTeamId(e.target.value)}
                            placeholder="e.g. CAMP01"
                            style={{ width: '100%', textTransform: 'uppercase' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>PASSWORD</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <button type="submit" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? 'CONNECTING...' : 'START GAME'}
                    </button>
                </form>
            </div>

            <p style={{ marginTop: '2rem', fontSize: '0.8rem', opacity: 0.7 }}>
                PRESS START 2P FONT LOADED
            </p>
        </div>
    );
};
