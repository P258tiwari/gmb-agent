import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Send, Eye, Loader2,
  X, Check, RefreshCw, FileText
} from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import api from '../lib/api';

function MetricCard({ number, label, icon, loading }) {
  if (loading) {
    return (
      <div className="card p-4 text-center animate-pulse">
        <div className="h-6 bg-[#F3F4F6] rounded w-16 mx-auto mb-2" />
        <div className="h-3 bg-[#F3F4F6] rounded w-20 mx-auto" />
      </div>
    );
  }
  return (
    <div className="card p-4 text-center">
      {icon && <div className="text-lg mb-1">{icon}</div>}
      <div className="text-[22px] font-bold text-[#111827] leading-tight">
        {typeof number === 'number' ? number.toLocaleString('en-IN') : number}
      </div>
      <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function PreviewModal({ clientId, monthYear, onClose }) {
  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get(`/reports/${clientId}/${monthYear}`)
      .then(r => setHtml(r.data.html))
      .catch(e => setError(e.response?.data?.error || 'Failed to load preview'))
      .finally(() => setLoading(false));
  }, [clientId, monthYear]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[12px] border border-[#E5E7EB] w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="text-[14px] font-semibold text-[#111827]">
            Report Preview — {monthYear}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors"
          >
            <X size={15} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-[#9CA3AF]">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading preview...
            </div>
          ) : error ? (
            <div className="py-10 text-center text-[13px] text-[#DC2626]">{error}</div>
          ) : (
            <iframe
              srcDoc={html}
              title="Report Preview"
              className="w-full border-0 rounded-lg"
              style={{ height: '70vh' }}
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClientReports() {
  const { clientId } = useParams();
  const [client,    setClient]    = useState(null);
  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [sendMsg,   setSendMsg]   = useState('');
  const [sendError, setSendError] = useState('');
  const [preview,   setPreview]   = useState(null); // monthYear string

  useEffect(() => {
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(() => {});
  }, [clientId]);

  const loadReports = useCallback(() => {
    setLoading(true);
    api.get(`/reports/${clientId}`)
      .then(r => setReports(r.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleSendNow = async (monthYear) => {
    setSending(true);
    setSendMsg('');
    setSendError('');
    try {
      const body = monthYear ? { monthYear } : {};
      const res  = await api.post(`/reports/${clientId}/send-now`, body);
      setReports(prev => {
        const exists = prev.find(r => r.monthYear === res.data.monthYear);
        return exists
          ? prev.map(r => r.monthYear === res.data.monthYear ? res.data : r)
          : [res.data, ...prev];
      });
      setSendMsg(res.data.sentTo
        ? `Report sent to ${res.data.sentTo}`
        : 'Report generated (no contact email set)');
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setSending(false);
    }
  };

  // Pull current-month metrics from the latest report (if it exists)
  const latestReport = reports[0];
  const m = latestReport?.metrics || client?.performance || {};

  const METRICS = [
    { label: 'Profile Views',      val: m.profileViews,      icon: '👁️' },
    { label: 'Search Impressions', val: m.searchImpressions, icon: '🔍' },
    { label: 'Phone Calls',        val: m.phoneCalls,        icon: '📞' },
    { label: 'Direction Clicks',   val: m.directionClicks,   icon: '📍' },
    { label: 'Website Clicks',     val: m.websiteClicks,     icon: '🌐' }
  ];

  return (
    <ClientLayout client={client}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Monthly Reports</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            {reports.length > 0
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} sent · Last: ${formatDate(reports[0]?.sentAt)}`
              : 'No reports sent yet'}
          </p>
        </div>
        <button
          onClick={() => handleSendNow()}
          disabled={sending}
          className="btn-primary disabled:opacity-60"
        >
          {sending
            ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
            : <><Send size={13} /> Send Report Now</>}
        </button>
      </div>

      {/* Feedback banners */}
      {sendMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[13px] text-[#16A34A] flex items-center gap-2">
          <Check size={14} /> {sendMsg}
        </div>
      )}
      {sendError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[13px] text-[#DC2626]">
          {sendError}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {METRICS.map(({ label, val, icon }) => (
          <MetricCard
            key={label}
            number={val ?? '—'}
            label={label}
            icon={icon}
            loading={loading && !client}
          />
        ))}
      </div>

      {/* Current month summary row */}
      {(m.postsPublished != null || m.reviewsTotal != null) && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <div className="text-[20px] font-bold text-[#111827]">{m.postsPublished ?? 0}</div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mt-1">Posts Published</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[20px] font-bold text-[#111827]">
              {m.reviewsReplied ?? 0}/{m.reviewsTotal ?? 0}
            </div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mt-1">Reviews Replied</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-[20px] font-bold text-[#111827]">{m.avgRating ?? '—'} ⭐</div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-wide mt-1">Avg Rating</div>
          </div>
        </div>
      )}

      {/* Past reports table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#111827]">Past Reports</h3>
          <button onClick={loadReports} className="text-[12px] text-[#6B7280] hover:text-[#374151] flex items-center gap-1">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-[#F3F4F6]">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
                <div className="h-3 bg-[#F3F4F6] rounded w-24" />
                <div className="h-3 bg-[#F3F4F6] rounded w-12" />
                <div className="h-3 bg-[#F3F4F6] rounded w-16" />
                <div className="h-3 bg-[#F3F4F6] rounded w-32 ml-auto" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-3xl mb-3">📄</div>
            <div className="text-[14px] font-semibold text-[#111827] mb-1">No reports yet</div>
            <p className="text-[13px] text-[#9CA3AF]">
              Click "Send Report Now" to generate and email the first monthly report.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                {['Month', 'Posts', 'Reviews', 'Avg Rating', 'Sent To', 'Sent', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left section-label whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr
                  key={report.id || report.monthYear}
                  className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors"
                >
                  <td className="px-5 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">
                    {report.month || report.monthYear}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#374151]">
                    {report.metrics?.postsPublished ?? report.postsCreated ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#374151]">
                    {report.metrics
                      ? `${report.metrics.reviewsReplied}/${report.metrics.reviewsTotal}`
                      : `${report.reviewsReplied ?? '—'}/${report.totalReviews ?? '—'}`}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#374151]">
                    {report.metrics?.avgRating ?? report.avgRating ?? '—'} ⭐
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#6B7280] max-w-[160px] truncate">
                    {report.sentTo || '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">
                    {formatDate(report.sentAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPreview(report.monthYear)}
                        className="text-[12px] text-[#2563EB] hover:underline flex items-center gap-1"
                      >
                        <Eye size={12} /> Preview
                      </button>
                      <button
                        onClick={() => handleSendNow(report.monthYear)}
                        disabled={sending}
                        className="text-[12px] text-[#6B7280] hover:text-[#374151] flex items-center gap-1 disabled:opacity-50"
                      >
                        <Send size={12} /> Resend
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          clientId={clientId}
          monthYear={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </ClientLayout>
  );
}
