import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import PostCard from '../components/PostCard';
import api from '../lib/api';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const FILTERS = ['All', 'PENDING', 'DRAFT', 'APPROVED', 'POSTED', 'FAILED'];

function toMonthYear(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function ClientContent() {
  const { clientId } = useParams();
  const [client,     setClient]     = useState(null);
  const [posts,      setPosts]      = useState([]);
  const [filter,     setFilter]     = useState('All');
  const [generating, setGenerating] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [genError,   setGenError]   = useState('');

  // Month navigation
  const [monthOffset, setMonthOffset] = useState(0);
  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + monthOffset);
  const monthYear = toMonthYear(displayDate);

  useEffect(() => {
    api.get(`/clients/${clientId}`)
      .then(r => setClient(r.data))
      .catch(() => {});
  }, [clientId]);

  const loadPosts = useCallback(() => {
    setLoading(true);
    api.get(`/content/${clientId}/content?month=${monthYear}`)
      .then(r => setPosts(r.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [clientId, monthYear]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const res = await api.post(`/content/${clientId}/content/generate?month=${monthYear}`);
      setPosts(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Generation failed';
      // 409 = already generated — reload existing
      if (err.response?.status === 409) {
        setPosts(err.response.data.posts || []);
        setGenError('Content already exists for this month.');
      } else {
        setGenError(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdate = (updated) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const filtered = filter === 'All' ? posts : posts.filter(p => p.status === filter);

  const stats = {
    scheduled: posts.filter(p => p.status === 'APPROVED').length,
    pending:   posts.filter(p => p.status === 'PENDING').length,
    posted:    posts.filter(p => p.status === 'POSTED').length,
    failed:    posts.filter(p => p.status === 'FAILED').length,
  };

  return (
    <ClientLayout client={client}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#111827]">Content Calendar</h1>
        <div className="flex items-center gap-4">
          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[14px] font-medium text-[#374151] w-36 text-center">
              {MONTHS[displayDate.getMonth()]} {displayDate.getFullYear()}
            </span>
            <button
              onClick={() => setMonthOffset(o => o + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary disabled:opacity-60"
          >
            {generating
              ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
              : <>✨ Generate Content</>}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {genError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[13px] text-[#D97706]">
          {genError}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Scheduled Posts', val: stats.scheduled },
          { label: 'Pending Approval', val: stats.pending },
          { label: 'Posted',           val: stats.posted   },
          { label: 'Failed',           val: stats.failed   }
        ].map(({ label, val }) => (
          <div key={label} className="card p-4">
            <div className="text-[20px] font-bold text-[#111827]">{val}</div>
            <div className="text-[12px] text-[#6B7280] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => {
          const count = f === 'All' ? posts.length : posts.filter(p => p.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full text-[13px] font-medium transition-colors"
              style={{
                padding: '6px 16px',
                background: filter === f ? '#2563EB' : 'white',
                color:      filter === f ? 'white'   : '#374151',
                border:     `1px solid ${filter === f ? '#2563EB' : '#E5E7EB'}`
              }}
            >
              {f}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="w-full bg-[#F3F4F6]" style={{ height: 180 }} />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-[#F3F4F6] rounded w-1/3" />
                <div className="h-3 bg-[#F3F4F6] rounded w-full" />
                <div className="h-3 bg-[#F3F4F6] rounded w-3/4" />
                <div className="h-8 bg-[#F3F4F6] rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">📅</div>
          <div className="text-[15px] font-semibold text-[#111827] mb-1">
            {posts.length === 0 ? 'No content yet for this month' : 'No posts match this filter'}
          </div>
          {posts.length === 0 && (
            <>
              <p className="text-[13px] text-[#9CA3AF] mb-4">
                Click "Generate Content" to create 8 AI-written posts for {MONTHS[displayDate.getMonth()]}.
              </p>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary disabled:opacity-60">
                {generating ? <Loader2 size={13} className="animate-spin" /> : '✨'}
                Generate Content
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              clientId={clientId}
              onUpdate={handleUpdate}
              useNewEndpoints={true}
            />
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
