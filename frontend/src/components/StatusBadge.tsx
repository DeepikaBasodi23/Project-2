type Variant =
  | 'APPROVE' | 'APPROVED'
  | 'REFER'
  | 'DECLINE' | 'DECLINED'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'AWAITING_DECISION'
  | 'DOCUMENTS_PENDING'
  | 'PASSED'
  | 'FLAGGED'
  | 'REQUEST_MORE_DOCS'
  | string;

interface Props {
  status: Variant | unknown;
  size?: 'sm' | 'md' | 'lg';
}

interface Style {
  bg: string;
  color: string;
  border: string;
  dot?: string;
  icon: string;
}

const STYLES: Record<string, Style> = {
  APPROVE: {
    bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    color: '#065f46',
    border: '#6ee7b7',
    dot: '#10b981',
    icon: '✓',
  },
  APPROVED: {
    bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    color: '#065f46',
    border: '#6ee7b7',
    dot: '#10b981',
    icon: '✓',
  },
  REFER: {
    bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    color: '#78350f',
    border: '#fbbf24',
    dot: '#f59e0b',
    icon: '↗',
  },
  DECLINE: {
    bg: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    color: '#7f1d1d',
    border: '#fca5a5',
    dot: '#ef4444',
    icon: '✕',
  },
  DECLINED: {
    bg: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    color: '#7f1d1d',
    border: '#fca5a5',
    dot: '#ef4444',
    icon: '✕',
  },
  SUBMITTED: {
    bg: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    color: '#4c1d95',
    border: '#a78bfa',
    dot: '#8b5cf6',
    icon: '◎',
  },
  PROCESSING: {
    bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    color: '#0c4a6e',
    border: '#7dd3fc',
    dot: '#3b82f6',
    icon: '⟳',
  },
  AWAITING_DECISION: {
    bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    color: '#78350f',
    border: '#fbbf24',
    dot: '#f59e0b',
    icon: '⏳',
  },
  DOCUMENTS_PENDING: {
    bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)',
    color: '#7c2d12',
    border: '#fdba74',
    dot: '#f97316',
    icon: '📄',
  },
  PASSED: {
    bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    color: '#065f46',
    border: '#6ee7b7',
    dot: '#10b981',
    icon: '✓',
  },
  FLAGGED: {
    bg: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    color: '#7f1d1d',
    border: '#fca5a5',
    dot: '#ef4444',
    icon: '⚑',
  },
  REQUEST_MORE_DOCS: {
    bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    color: '#334155',
    border: '#cbd5e1',
    dot: '#64748b',
    icon: '📋',
  },
};

const LABELS: Record<string, string> = {
  AWAITING_DECISION: 'AWAITING DECISION',
  DOCUMENTS_PENDING: 'DOCS PENDING',
  REQUEST_MORE_DOCS: 'MORE DOCS',
};

function normalizeStatus(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const candidate = (value as { recommendation?: unknown; status?: unknown; value?: unknown; label?: unknown }).recommendation
      ?? (value as { status?: unknown }).status
      ?? (value as { value?: unknown }).value
      ?? (value as { label?: unknown }).label;
    if (typeof candidate === 'string') return candidate;
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
    return '';
  }
  return '';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const normalizedStatus = normalizeStatus(status);
  const style = STYLES[normalizedStatus] || {
    bg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    color: '#334155',
    border: '#cbd5e1',
    icon: '•',
  };

  const label = LABELS[normalizedStatus] || normalizedStatus || 'PENDING';

  const sizes = {
    sm: { fontSize: '10px', padding: '3px 8px', gap: '4px', dotSize: '5px' },
    md: { fontSize: '11px', padding: '4px 10px', gap: '5px', dotSize: '6px' },
    lg: { fontSize: '13px', padding: '6px 14px', gap: '6px', dotSize: '7px' },
  };
  const s = sizes[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      background: style.bg,
      color: style.color,
      padding: s.padding,
      borderRadius: 'var(--radius-full)',
      fontSize: s.fontSize,
      fontWeight: 700,
      letterSpacing: '0.4px',
      border: `1px solid ${style.border}`,
      whiteSpace: 'nowrap',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      {style.dot && (
        <span style={{
          width: s.dotSize,
          height: s.dotSize,
          borderRadius: '50%',
          background: style.dot,
          flexShrink: 0,
          display: 'inline-block',
        }} />
      )}
      {label}
    </span>
  );
}
