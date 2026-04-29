export default function StatusPill({ status }) {
  const configs = {
    ACTIVE:     { bg: '#F0FDF4', text: '#16A34A', dot: true },
    CONNECTED:  { bg: '#F0FDF4', text: '#16A34A', dot: true },
    PENDING:    { bg: '#FFFBEB', text: '#D97706' },
    DRAFT:      { bg: '#EFF6FF', text: '#2563EB' },
    APPROVED:   { bg: '#F0FDF4', text: '#16A34A' },
    POSTED:     { bg: '#F0FDF4', text: '#16A34A' },
    FAILED:     { bg: '#FEF2F2', text: '#DC2626' },
    Verified:   { bg: '#F0FDF4', text: '#16A34A', dot: true },
    Submitted:  { bg: '#EFF6FF', text: '#2563EB' },
  };
  const cfg = configs[status] || { bg: '#F3F4F6', text: '#374151' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.text, padding: '3px 10px' }}
    >
      {cfg.dot && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.text }} />
      )}
      {status}
    </span>
  );
}
