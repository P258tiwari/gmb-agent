import { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import api from '../lib/api';

export default function PendingApprovals() {
  const [posts, setPosts] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientMap, setClientMap] = useState({});
  const [selectedClient, setSelectedClient] = useState('all');
  const [approveAllLoading, setApproveAllLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [postsRes, clientsRes] = await Promise.allSettled([
      api.get('/clients/pending/all'),
      api.get('/clients')
    ]);

    const fetchedPosts = postsRes.status === 'fulfilled' ? postsRes.value.data : [];
    const fetchedClients = clientsRes.status === 'fulfilled' ? clientsRes.value.data : [];

    const sorted = [...fetchedPosts].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    setPosts(sorted);
    setClients(fetchedClients);

    const map = {};
    fetchedClients.forEach(c => { map[c.id] = c.businessName || c.name; });
    setClientMap(map);
  };

  const handleUpdate = (updatedPost) => {
    if (updatedPost.status === 'APPROVED' || updatedPost.status === 'REJECTED') {
      setPosts(prev => prev.filter(p => p.id !== updatedPost.id));
    } else {
      setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    }
  };

  const handleApproveAll = async () => {
    setApproveAllLoading(true);
    try {
      await api.post('/content/global/approve-all');
      setPosts([]);
    } finally { setApproveAllLoading(false); }
  };

  const filtered = selectedClient === 'all'
    ? posts
    : posts.filter(p => p.clientId === selectedClient);

  const uniqueClientIds = [...new Set(posts.map(p => p.clientId))];
  const clientsWithPending = clients.filter(c => uniqueClientIds.includes(c.id));

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#111827]">Pending Approvals</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            {posts.length} post{posts.length !== 1 ? 's' : ''} waiting for your review
          </p>
        </div>
        {posts.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approveAllLoading}
            className="btn-primary disabled:opacity-60"
          >
            {approveAllLoading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Approve All ({posts.length})
          </button>
        )}
      </div>

      {/* Client filter */}
      {clientsWithPending.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <FilterPill label="All Clients" count={posts.length} active={selectedClient === 'all'} onClick={() => setSelectedClient('all')} />
          {clientsWithPending.map(c => {
            const count = posts.filter(p => p.clientId === c.id).length;
            return (
              <FilterPill
                key={c.id}
                label={c.businessName || c.name}
                count={count}
                active={selectedClient === c.id}
                onClick={() => setSelectedClient(c.id)}
              />
            );
          })}
        </div>
      )}

      {/* Posts grid */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-[16px] font-semibold text-[#111827] mb-1">All caught up!</div>
          <div className="text-[13px] text-[#6B7280]">No posts are waiting for approval right now.</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map(post => (
            <PostCard
              key={post.id}
              post={post}
              clientId={post.clientId}
              clientName={clientMap[post.clientId] || post.clientId}
              onUpdate={handleUpdate}
              useNewEndpoints
            />
          ))}
        </div>
      )}
    </Layout>
  );
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5"
      style={{
        padding: '6px 16px',
        background: active ? '#2563EB' : 'white',
        color: active ? 'white' : '#374151',
        border: `1px solid ${active ? '#2563EB' : '#E5E7EB'}`
      }}
    >
      {label}
      <span
        className="text-[11px] font-semibold rounded-full px-1.5"
        style={{
          background: active ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
          color: active ? 'white' : '#6B7280'
        }}
      >
        {count}
      </span>
    </button>
  );
}
