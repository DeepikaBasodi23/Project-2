// React is required for JSX in this project

interface Props {
  score: number;
  label: string;
  max?: number;
  color?: string;
}

export default function ScoreBar({ score, label, max = 100, color }: Props) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const barColor =
    color ||
    (pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c');

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: '#555' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: barColor }}>
          {typeof score === 'number' ? score.toFixed(1) : score}/{max}
        </span>
      </div>
      <div
        style={{
          height: '8px',
          background: '#e9ecef',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: '4px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}
