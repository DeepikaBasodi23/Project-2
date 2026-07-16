import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ApplicantPortal from './pages/ApplicantPortal';
import UnderwriterDashboard from './pages/UnderwriterDashboard';
import AuditHistory from './pages/AuditHistory';

const navStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)',
  padding: '0 24px',
  display: 'flex',
  alignItems: 'center',
  gap: '32px',
  height: '60px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const logoStyle: React.CSSProperties = {
  color: '#e94560',
  fontWeight: 700,
  fontSize: '18px',
  letterSpacing: '0.5px',
  textDecoration: 'none',
  marginRight: 'auto',
};

export default function App() {
  const location = useLocation();

  const linkStyle = (path: string): React.CSSProperties => ({
    color: location.pathname === path ? '#e94560' : '#ccd6f6',
    textDecoration: 'none',
    fontWeight: location.pathname === path ? 600 : 400,
    fontSize: '14px',
    padding: '4px 0',
    borderBottom: location.pathname === path ? '2px solid #e94560' : '2px solid transparent',
    transition: 'all 0.2s',
  });

  return (
    <div>
      <nav style={navStyle}>
        <Link to="/" style={logoStyle}>🏦 LoanAgent</Link>
        <Link to="/" style={linkStyle('/')}>Apply</Link>
        <Link to="/underwriter" style={linkStyle('/underwriter')}>Underwriter</Link>
        <Link to="/audit" style={linkStyle('/audit')}>Audit</Link>
      </nav>
      <main style={{ minHeight: 'calc(100vh - 60px)' }}>
        <Routes>
          <Route path="/" element={<ApplicantPortal />} />
          <Route path="/underwriter" element={<UnderwriterDashboard />} />
          <Route path="/audit" element={<AuditHistory />} />
        </Routes>
      </main>
    </div>
  );
}
