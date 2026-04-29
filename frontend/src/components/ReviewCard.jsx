import { useState } from 'react';
import { Star, RefreshCw } from 'lucide-react';
import api from '../lib/api';

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          size={13}
          className={i <= rating ? 'text-[#D97706] fill-[#D97706]' : 'text-[#E5E7EB] fill-[#E5E7EB]'}
        />
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function ReviewCard({ review, clientId, onUpdate }) {
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateReply = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/reviews/${clientId}/${review.id}/generate-reply`);
      setReplyText(res.data.reply);
      setEditing(true);
    } finally { setGenerating(false); }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/reviews/${clientId}/${review.id}/reply`, { reply: replyText });
      onUpdate(res.data);
      setEditing(false);
      setReplyText('');
    } finally { setLoading(false); }
  };

  return (
    <div className="card p-5 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[14px] font-semibold text-[#111827]">{review.reviewerName}</div>
          <StarRating rating={review.rating} />
        </div>
        <div className="text-[12px] text-[#6B7280]">{timeAgo(review.date)}</div>
      </div>

      {/* Review text */}
      <p className="text-[13px] text-[#374151] leading-relaxed">{review.text}</p>

      <div className="border-t border-[#F3F4F6] pt-3">
        {review.reply ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="section-label">Your Reply</span>
                {review.autoReplied && (
                  <span
                    className="text-[10px] font-medium rounded-full"
                    style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px' }}
                  >
                    AI
                  </span>
                )}
              </div>
              {review.repliedAt && (
                <span className="text-[11px] text-[#9CA3AF]">{timeAgo(review.repliedAt)}</span>
              )}
            </div>
            <p className="text-[13px] text-[#6B7280] italic leading-relaxed">{review.reply}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 rounded-full text-[11px] font-medium"
                style={{ background: '#FFFBEB', color: '#D97706', padding: '3px 10px' }}
              >
                Awaiting Reply
              </span>
              <button
                onClick={handleGenerateReply}
                disabled={generating}
                className="text-[12px] text-[#2563EB] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {generating ? <RefreshCw size={11} className="animate-spin" /> : null}
                {generating ? 'Generating...' : 'AI Generate Reply'}
              </button>
            </div>
            {editing && (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="form-textarea text-[13px]"
                  placeholder="Write your reply..."
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="btn-secondary text-[12px] py-1.5 px-3">
                    Cancel
                  </button>
                  <button onClick={handleSubmitReply} disabled={loading} className="btn-primary text-[12px] py-1.5 px-3 disabled:opacity-50">
                    {loading ? 'Sending...' : 'Post Reply'}
                  </button>
                </div>
              </div>
            )}
            {!editing && !generating && (
              <button
                onClick={() => setEditing(true)}
                className="text-[12px] text-[#6B7280] hover:text-[#374151]"
              >
                Write manual reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
