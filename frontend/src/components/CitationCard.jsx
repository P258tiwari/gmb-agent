import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import api from '../lib/api';

const STATUSES = ['Pending', 'Submitted', 'Verified'];

const STATUS_STYLE = {
  Pending:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Submitted: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Verified:  { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
};

function timeAgo(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CitationCard({ citation, clientId, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handleStatus = async (status) => {
    if (citation.status === status) return;
    setLoading(true);
    try {
      const res = await api.put(`/citations/${clientId}/${citation.id}/status`, { status });
      onUpdate(res.data);
    } finally {
      setLoading(false);
    }
  };

  const style = STATUS_STYLE[citation.status] || STATUS_STYLE.Pending;
  const ts    = citation.status === 'Verified'  ? citation.verifiedAt
              : citation.status === 'Submitted' ? citation.submittedAt
              : null;

  return (
    <div className="card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#111827] truncate">{citation.siteName}</div>
          <a
            href={citation.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-[#2563EB] hover:underline mt-0.5"
          >
            {citation.siteUrl.replace(/^https?:\/\//, '')}
            <ExternalLink size={10} />
          </a>
        </div>
        <span
          className="flex-shrink-0 text-[11px] font-medium rounded-full"
          style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, padding: '3px 10px' }}
        >
          {citation.status}
          {ts && <span className="ml-1 opacity-70">· {timeAgo(ts)}</span>}
        </span>
      </div>

      {/* Why */}
      <div>
        <div className="section-label mb-1">Why This Site</div>
        <p className="text-[13px] text-[#6B7280] leading-relaxed">{citation.why}</p>
      </div>

      <div className="border-t border-[#F3F4F6]" />

      {/* Steps */}
      <div>
        <div className="section-label mb-2">How to Submit</div>
        <ol className="space-y-1.5">
          {(citation.steps || []).map((step, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-[#374151] leading-snug">
              <span
                className="flex-shrink-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: '#EFF6FF', color: '#2563EB' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Status toggle */}
      <div className="flex gap-2 pt-1">
        {STATUSES.map(s => {
          const active = citation.status === s;
          const sStyle = STATUS_STYLE[s];
          return (
            <button
              key={s}
              disabled={loading || active}
              onClick={() => handleStatus(s)}
              className="flex-1 py-1.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default"
              style={active ? {
                background: sStyle.bg,
                color:      sStyle.color,
                border:     `1px solid ${sStyle.border}`
              } : {
                background: 'white',
                color:      '#374151',
                border:     '1px solid #E5E7EB'
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
