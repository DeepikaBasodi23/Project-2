// React is required for JSX in this project

type Variant = 'APPROVE' | 'REFER' | 'DECLINE' | 'APPROVED' | 'DECLINED' | 'SUBMITTED'
  | 'PROCESSING' | 'AWAITING_DECISION' | 'DOCUMENTS_PENDING' | 'PASSED' | 'FLAGGED'
  | 'REQUEST_MORE_DOCS' | string;

interface Props {
  status: Variant;
  size?: 'sm' | 'md';
}

const COLORS: Record<string, { bg: string; color: string }> = {
  APPROVE:           { bg: '#d4edda', color: '#155724' },
  APPROVED:          { bg: '#d4edda', color: '#155724' },
  REFER:             { bg: '#fff3cd', color: '#856404' },
  DECLINE:           { bg: '#f8d7da', color: '#721c24' },
  DECLINED:          { bg: '#f8d7da', color: '#721c24' },
  SUBMITTED:         { bg: '#cce5ff', color: '#004085' },
  PROCESSING:        { bg: '#d1ecf1', color: '#0c5460' },
  AWAITING_DECISION: { bg: '#fff3cd', color: '#856404' },
  DOCUMENTS_PENDING: { bg: '#ffeeba', color: '#856404' },
  PASSED:            { bg: '#d4edda', color: '#155724' },
  FLAGGED:           { bg: '#f8d7da', color: '#721c24' },
  REQUEST_MORE_DOCS: { bg: '#e2e3e5', color: '#383d41' },
};

const LABELS: Record<string, string> = {
  AWAITING_DECISION: 'AWAITING DECISION',
  DOCUMENTS_PENDING: 'DOCS PENDING',
  REQUEST_MORE_DOCS: 'MORE DOCS',
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const style = COLORS[status] || { bg: '#e2e3e5', color: '#383d41' };
  const label = LABELS[status] || status;
  const fontSize = size === 'sm' ? '11px' : '12px';
  const padding = size === 'sm' ? '2px 6px' : '3px 10px';

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding,
        borderRadius: '12px',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.3px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
