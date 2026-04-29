import { useState } from 'react';
import { Calendar, Clock, Heart, Share2, AlertCircle, Pencil, X, RefreshCw, Check } from 'lucide-react';
import StatusPill from './StatusPill';
import api from '../lib/api';

const TYPE_COLORS = {
  SERVICE: { bg: '#2563EB', label: 'SERVICE' },
  TIP:     { bg: '#16A34A', label: 'TIP' },
  OFFER:   { bg: '#D97706', label: 'OFFER' },
  LOCAL:   { bg: '#7C3AED', label: 'LOCAL' }
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export default function PostCard({ post, clientId, onUpdate, useNewEndpoints = false, clientName }) {
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = useNewEndpoints
        ? await api.put(`/content/${clientId}/content/${post.id}/approve`)
        : await api.post(`/content/${clientId}/posts/${post.id}/approve`);
      onUpdate(res.data);
    } finally { setLoading(false); }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = useNewEndpoints
        ? await api.put(`/content/${clientId}/content/${post.id}/reject`)
        : await api.post(`/content/${clientId}/posts/${post.id}/reject`);
      onUpdate(res.data);
    } finally { setLoading(false); }
  };

  const typeConfig = TYPE_COLORS[post.type] || TYPE_COLORS.SERVICE;

  return (
    <>
      <div className="card overflow-hidden flex flex-col">
        {/* Client name badge */}
        {clientName && (
          <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-[#F3F4F6]">
            <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">{clientName}</span>
            <StatusPill status={post.status} />
          </div>
        )}
        {/* Image */}
        <div className="relative">
          <img
            src={post.imageUrl || `https://placehold.co/1200x900/2563EB/FFFFFF?text=${encodeURIComponent(post.title || 'Post')}`}
            alt={post.title}
            className="w-full object-cover"
            style={{ height: '180px' }}
            onError={e => { e.target.src = `https://placehold.co/1200x900/E5E7EB/9CA3AF?text=Image`; }}
          />
          {/* Type badge */}
          <span
            className="absolute top-2 left-2 text-white text-[11px] font-medium rounded-md"
            style={{ background: typeConfig.bg, padding: '3px 10px' }}
          >
            {typeConfig.label}
          </span>
          {/* Status pill — only shown in image overlay when no client header */}
          {!clientName && (
            <span className="absolute top-2 right-2">
              <StatusPill status={post.status} />
            </span>
          )}
          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            className="absolute bottom-2 right-2 w-7 h-7 bg-white rounded-md shadow flex items-center justify-center hover:bg-[#F9FAFB] transition-colors"
          >
            <Pencil size={12} className="text-[#374151]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
            <Calendar size={12} />
            {formatDate(post.scheduledAt)}
          </div>
          <p className="text-[13px] text-[#374151] leading-relaxed line-clamp-3">
            {post.body}
          </p>
          {post.cta && (
            <p className="text-[12px] text-[#2563EB] font-medium">{post.cta}</p>
          )}

          {/* Actions */}
          <div className="mt-auto pt-2">
            {(post.status === 'PENDING' || post.status === 'DRAFT') && (
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 py-2 text-[13px] font-medium border border-[#E5E7EB] text-[#374151] rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 py-2 text-[13px] font-medium bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            )}
            {post.status === 'APPROVED' && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280]">
                <Clock size={12} />
                Scheduled for publication
              </div>
            )}
            {post.status === 'POSTED' && (
              <div className="flex items-center gap-4 text-[12px] text-[#6B7280]">
                <span className="flex items-center gap-1"><Heart size={12} /> {post.likes || 0}</span>
                <span className="flex items-center gap-1"><Share2 size={12} /> {post.shares || 0}</span>
              </div>
            )}
            {post.status === 'FAILED' && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#DC2626] flex items-center gap-1">
                  <AlertCircle size={12} /> Failed to post
                </span>
                <button onClick={handleApprove} className="text-[12px] text-[#DC2626] font-medium hover:underline">
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <EditPostModal
          post={post}
          clientId={clientId}
          useNewEndpoints={useNewEndpoints}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => { onUpdate(updated); setEditOpen(false); }}
        />
      )}
    </>
  );
}

function EditPostModal({ post, clientId, onClose, onSave, useNewEndpoints = false }) {
  const [form, setForm] = useState({
    title: post.title || '',
    body: post.body || '',
    cta: post.cta || '',
    imageUrl: post.imageUrl || '',
    scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : ''
  });
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = useNewEndpoints
        ? `/content/${clientId}/content/${post.id}`
        : `/content/${clientId}/posts/${post.id}`;
      const res = await api.put(endpoint, {
        ...form,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : post.scheduledAt
      });
      onSave(res.data);
    } finally { setSaving(false); }
  };

  const handleRegenImage = async () => {
    setRegenerating(true);
    try {
      const endpoint = useNewEndpoints
        ? `/content/${clientId}/content/${post.id}/regenerate-image`
        : `/content/${clientId}/posts/${post.id}/regenerate-image`;
      const res = await api.post(endpoint, { prompt: imagePrompt || form.title });
      setForm(f => ({ ...f, imageUrl: res.data.imageUrl }));
    } finally { setRegenerating(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] border border-[#E5E7EB] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="text-[15px] font-semibold text-[#111827]">Edit Post</div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors">
            <X size={15} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Image preview */}
          <div>
            <label className="form-label">Post Image</label>
            <div className="relative rounded-lg overflow-hidden border border-[#E5E7EB]" style={{ height: '200px' }}>
              <img
                src={form.imageUrl || `https://placehold.co/1200x900/E5E7EB/9CA3AF?text=No+Image`}
                alt="Post"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder="Image generation prompt (or uses title)"
                className="form-input flex-1"
              />
              <button
                onClick={handleRegenImage}
                disabled={regenerating}
                className="btn-secondary flex-shrink-0 disabled:opacity-50"
              >
                {regenerating ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Regenerate
              </button>
            </div>
            <div className="mt-1.5">
              <input
                type="text"
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="Or paste image URL directly"
                className="form-input"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="form-input"
            />
          </div>

          {/* Body */}
          <div>
            <label className="form-label">Post Content</label>
            <textarea
              rows={6}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="form-textarea"
            />
          </div>

          {/* CTA */}
          <div>
            <label className="form-label">Call to Action</label>
            <input
              type="text"
              value={form.cta}
              onChange={e => setForm(f => ({ ...f, cta: e.target.value }))}
              className="form-input"
              placeholder="e.g. Book your appointment today!"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="form-label">Scheduled Date & Time</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              className="form-input"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB]">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
