import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ApplicantPortal from './pages/ApplicantPortal';
import UnderwriterDashboard from './pages/UnderwriterDashboard';
import AuditHistory from './pages/AuditHistory';
import ProfessionalLogin from './pages/ProfessionalLogin';

/* ── Inner layout (needs access to AuthContext) ─────────────────── */
function Layout() {
  const location           = useLocation();
  const navigate           = useNavigate();
  const { role, logout }   = useAuth();
  const isProfessional     = role === 'professional';
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Navbar ── */}
      <nav style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.2)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        height: '64px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginRight: 'auto' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '10px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>🏦</div>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px',
            background: 'linear-gradient(135deg, #e0e7ff, #a5b4fc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.3px',
          }}>LoanAgent</span>
          <span style={{
            fontSize: '10px', fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', padding: '2px 7px', borderRadius: '20px',
            letterSpacing: '0.5px', marginLeft: '-4px',
          }}>AI</span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {/* Apply — always visible */}
          <NavLink to="/" icon="📝" label="Apply" active={isActive('/')} />

          {/* Underwriter & Audit — only visible when logged in as professional */}
          {isProfessional && (
            <>
              <NavLink to="/underwriter" icon="🔍" label="Underwriter" active={isActive('/underwriter')} />
              <NavLink to="/audit"       icon="📋" label="Audit"       active={isActive('/audit')} />
            </>
          )}

          {/* Divider */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

          {/* Login / Logout */}
          {isProfessional ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '12px', color: '#a5b4fc', fontWeight: 500,
                background: 'rgba(99,102,241,0.15)', padding: '4px 10px',
                borderRadius: '20px', border: '1px solid rgba(99,102,241,0.3)',
              }}>
                🔓 Professional
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '7px 16px', borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#fca5a5', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '8px 18px', borderRadius: '8px',
                border: '1px solid rgba(99,102,241,0.4)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
                color: '#c7d2fe', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.18s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))';
              }}
            >
              🔐 Professional Login
            </button>
          )}

          {/* Live dot */}
          <div style={{
            marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '20px', padding: '5px 12px',
            fontSize: '12px', color: '#6ee7b7', fontWeight: 500,
          }}>
            <span style={{
              width: '6px', height: '6px', background: '#10b981', borderRadius: '50%',
              boxShadow: '0 0 6px #10b981', animation: 'pulse 2s infinite',
              display: 'inline-block',
            }} />
            Live
          </div>
        </div>
      </nav>

      {/* ── Routes ── */}
      <main style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Routes>
          <Route path="/"      element={<ApplicantPortal />} />
          <Route path="/login" element={<ProfessionalLogin />} />
          <Route path="/underwriter" element={
            <ProtectedRoute><UnderwriterDashboard /></ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute><AuditHistory /></ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

/* ── Reusable NavLink ──────────────────────────────────────────── */
function NavLink({ to, icon, label, active }: { to: string; icon: string; label: string; active: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      color: active ? '#fff' : 'rgba(199,210,254,0.7)',
      textDecoration: 'none',
      fontWeight: active ? 600 : 400,
      fontSize: '14px', padding: '8px 16px', borderRadius: '8px',
      background: active
        ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))'
        : 'transparent',
      border: active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
      transition: 'all 0.18s',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)';
        (e.currentTarget as HTMLElement).style.color = '#e0e7ff';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'rgba(199,210,254,0.7)';
      }
    }}
    >
      <span style={{ fontSize: '15px' }}>{icon}</span>
      {label}
    </Link>
  );
}

/* ── Root export (wraps everything in AuthProvider) ────────────── */
export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
