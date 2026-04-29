import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Loader2, MessageSquare } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import ReviewCard from '../components/ReviewCard';
import api from '../lib/api';

export default function ClientReviews() {
  const { clientId } = useParams();
  const [client,       setClient]       = useState(null);
  const [reviews,      setReviews]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [bulkReplying, setBulkReplying] = useState(false);
  const [syncMsg,      setSyncMsg]      = useState('');
  const [starFilter,   setStarFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(() => {});
  }, [clientId]);

  const loadReviews = useCallback(() => {
    setLoading(true);
    api.get(`/reviews/${clientId}`)
      .then(r => setReviews(r.data))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post(`/reviews/${clientId}/sync`);
      setSyncMsg(res.data.message || `Synced ${res.data.synced} reviews from Google`);
      loadReviews();
    } catch (err) {
      setSyncMsg(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkReply = async () => {
    setBulkReplying(true);
    setSyncMsg('');
    try {
      const res = await api.post(`/reviews/${clientId}/bulk-reply`);
      setSyncMsg(res.data.message || `Replied to ${res.data.replied} reviews`);
      loadReviews();
    } catch (err) {
      setSyncMsg(err.response?.data?.error || 'Bulk reply failed');
    } finally {
      setBulkReplying(false);
    }
  };

  const handleUpdate = (updated) => {
    setReviews(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const total     = reviews.length;
  const replied   = reviews.filter(r =>  r.reply).length;
  const unreplied = total - replied;
  const avgRating = total
    ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : '0.0';

  const filtered = reviews.filter(r => {
    if (starFilter !== 'all') {
      if (starFilter === '1-2') { if (r.rating > 2)              return false; }
      else                      { if (r.rating !== parseInt(starFilter)) return false; }
    }
    if (statusFilter === 'replied'   && !r.reply) return false;
    if (statusFilter === 'unreplied' &&  r.reply) return false;
    return true;
  });

  return (
    <ClientLayout client={client}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#111827]">Reviews Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary disabled:opacity-60"
          >
            {syncing
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            Sync from GBP
          </button>
          {unreplied > 0 && (
            <button
              onClick={handleBulkReply}
              disabled={bulkReplying}
              className="btn-primary disabled:opacity-60"
            >
              {bulkReplying
                ? <Loader2 size={13} className="animate-spin" />
                : <MessageSquare size={13} />}
              {bulkReplying ? 'Replying...' : `Reply All (${unreplied})`}
            </button>
          )}
        </div>
      </div>

      {/* Sync feedback */}
      {syncMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[13px] text-[#16A34A]">
          {syncMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Reviews',  val: total },
          { label: 'Replied',        val: replied },
          { label: 'Unreplied',      val: unreplied,  warn: unreplied > 0 },
          { label: 'Avg Rating',     val: `${avgRating} ⭐` }
        ].map(({ label, val, warn }) => (
          <div
            key={label}
            className={`card p-4 ${warn ? 'bg-[#FFFBEB] border-[#FDE68A]' : ''}`}
          >
            <div className={`text-[20px] font-bold ${warn ? 'text-[#D97706]' : 'text-[#111827]'}`}>
              {val}
            </div>
            <div className="text-[12px] text-[#6B7280] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <div className="flex gap-2">
          {['all', '5', '4', '3', '1-2'].map(s => (
            <button
              key={s}
              onClick={() => setStarFilter(s)}
              className="rounded-full text-[13px] font-medium transition-colors"
              style={{
                padding:    '5px 14px',
                background: starFilter === s ? '#2563EB' : 'white',
                color:      starFilter === s ? 'white'   : '#374151',
                border:     `1px solid ${starFilter === s ? '#2563EB' : '#E5E7EB'}`
              }}
            >
              {s === 'all' ? 'All ⭐' : s === '1-2' ? '1-2 ⭐' : `${s} ⭐`}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E5E7EB]" />

        <div className="flex gap-2">
          {[['all', 'All'], ['replied', 'Replied'], ['unreplied', 'Unreplied']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className="rounded-full text-[13px] font-medium transition-colors"
              style={{
                padding:    '5px 14px',
                background: statusFilter === val ? '#2563EB' : 'white',
                color:      statusFilter === val ? 'white'   : '#374151',
                border:     `1px solid ${statusFilter === val ? '#2563EB' : '#E5E7EB'}`
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="space-y-1.5">
                  <div className="h-3.5 bg-[#F3F4F6] rounded w-32" />
                  <div className="h-3 bg-[#F3F4F6] rounded w-24" />
                </div>
                <div className="h-3 bg-[#F3F4F6] rounded w-16" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-[#F3F4F6] rounded w-full" />
                <div className="h-3 bg-[#F3F4F6] rounded w-4/5" />
              </div>
              <div className="h-8 bg-[#F3F4F6] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">⭐</div>
          <div className="text-[15px] font-semibold text-[#111827] mb-1">
            {total === 0 ? 'No reviews yet' : 'No reviews match this filter'}
          </div>
          {total === 0 && (
            <p className="text-[13px] text-[#9CA3AF] mb-4">
              Click "Sync from GBP" to pull reviews from Google Business Profile.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              clientId={clientId}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
