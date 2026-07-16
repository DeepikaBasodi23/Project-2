interface Props {
  score: number;
  label: string;
  max?: number;
  color?: string;
}

export default function ScoreBar({ score, label, max = 100, color }: Props) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));

  const autoColor = pct >= 70
    ? '#10b981'   // green
    : pct >= 50
    ? '#f59e0b'   // amber
    : '#ef4444';  // red

  const barColor = color || autoColor;

  const glowColor = pct >= 70
    ? 'rgba(16,185,129,0.35)'
    : pct >= 50
    ? 'rgba(245,158,11,0.35)'
    : 'rgba(239,68,68,0.35)';

  const gradientBar = color
    ? color
    : pct >= 70
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : pct >= 50
    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
    : 'linear-gradient(90deg, #ef4444, #f87171)';

  return (
    <div style={{ marginBottom: '14px' }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
      }}>
        <span style={{
          fontSize: '13px',
          color: 'var(--gray-600)',
          fontWeight: 500,
        }}>{label}</span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: barColor,
            minWidth: '48px',
            textAlign: 'right',
          }}>
            {typeof score === 'number' ? score.toFixed(1) : score}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--gray-400)',
            fontWeight: 500,
          }}>/ {max}</span>
        </div>
      </div>

      {/* Track */}
      <div style={{
        height: '10px',
        background: 'var(--gray-200)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Fill */}
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: gradientBar,
          borderRadius: 'var(--radius-full)',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: pct > 5 ? `0 0 8px ${glowColor}` : 'none',
          position: 'relative',
        }}>
          {/* Shimmer */}
          {pct > 10 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
              borderRadius: 'inherit',
            }} />
          )}
        </div>
      </div>
    </div>
  );
}
