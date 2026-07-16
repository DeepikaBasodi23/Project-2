import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfessionalLogin() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // After login, go back to the page they tried to visit
  const from = (location.state as { from?: string })?.from || '/underwriter';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Small delay so it feels like a real auth check
    await new Promise((r) => setTimeout(r, 400));
    const ok = login(password);
    setLoading(false);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '48px 40px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(99,102,241,0.2)',
        textAlign: 'center',
      }} className="fade-in">

        {/* Icon */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px',
          boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
        }}>🔐</div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px', fontWeight: 800,
          color: '#0f172a', marginBottom: '8px',
        }}>Professional Access</h1>

        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
          The Underwriter and Audit areas are restricted to licensed professionals.
          Enter your access password to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: 700,
              color: '#475569', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Access Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter professional password"
              autoFocus
              style={{
                width: '100%', padding: '12px 16px',
                border: error ? '2px solid #ef4444' : '2px solid #e2e8f0',
                borderRadius: '10px', fontSize: '15px',
                color: '#0f172a', outline: 'none',
                transition: 'border-color 0.18s',
                background: error ? '#fef2f2' : '#f8fafc',
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
              border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '13px', color: '#7f1d1d',
              marginBottom: '16px', textAlign: 'left',
              display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '13px',
              background: loading || !password
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontWeight: 700, fontSize: '15px',
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              boxShadow: loading || !password ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
              transition: 'all 0.18s',
            }}
          >
            {loading ? '🔄 Verifying...' : '🔓 Access Professional Portal'}
          </button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            Not a professional?{' '}
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); navigate('/'); }}
              style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}
            >
              Go to Loan Application →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
