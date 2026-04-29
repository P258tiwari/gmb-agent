import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, FileText, Star, Bell, ArrowUpRight, Plus } from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import StatusPill from '../components/StatusPill';
import api from '../lib/api';

const CATEGORY_ICONS = {
  'Healthcare & Medical': { emoji: '🦷', bg: '#EFF6FF' },
  'Real Estate':          { emoji: '🏠', bg: '#F0FDF4' },
  'Home Services':        { emoji: '🔧', bg: '#FFFBEB' },
  'Beauty & Wellness':    { emoji: '✨', bg: '#F5F3FF' },
  'Restaurant & Food':    { emoji: '🍽️', bg: '#FFF7ED' },
  'Education':            { emoji: '📚', bg: '#EFF6FF' },
  'Retail & Shopping':    { emoji: '🛍️', bg: '#FDF4FF' },
  'Automotive':           { emoji: '🚗', bg: '#F0FDF4' },
  'Salon & Beauty':       { emoji: '💅', bg: '#FDF4FF' },
  'Other':                { emoji: '🏢', bg: '#F9FAFB' }
};

// Returns the display name regardless of which field structure was used
function clientDisplayName(client) {
  return client.businessName || client.name || 'Unnamed Client';
}

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingClients, setLoadingClients] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/clients')
      .then(r => setClients(r.data))
      .catch(() => {})
      .finally(() => setLoadingClients(false));

    api.get('/clients/pending/all')
      .then(r => setPendingCount(r.data.length))
      .catch(() => {});
  }, []);

  const totalPosts = clients.reduce((s, c) => s + (c.stats?.posts || 0), 0);
  const totalReviews = clients.reduce((s, c) => s + (c.stats?.reviews || 0), 0);

  const newThisMonth = clients.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <Layout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-[#111827]">Dashboard</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          number={clients.length}
          label="Total Clients"
          sub={newThisMonth > 0 ? `+${newThisMonth} this month` : 'No new clients this month'}
          subColor={newThisMonth > 0 ? '#16A34A' : '#6B7280'}
        />
        <StatCard
          icon={FileText}
          number={totalPosts}
          label="Posts Published"
          sub={totalPosts > 0 ? 'Across all clients' : 'No posts yet'}
          subColor="#6B7280"
        />
        <StatCard
          icon={Star}
          number={totalReviews}
          label="Total Reviews"
          sub={totalReviews > 0 ? 'Across all clients' : 'No reviews yet'}
          subColor="#6B7280"
        />
        <StatCard
          icon={Bell}
          iconColor="#2563EB"
          number={pendingCount}
          label="Pending Approvals"
          sub={
            <Link to="/pending" className="text-[#2563EB] hover:underline font-medium">
              Take Action →
            </Link>
          }
          highlight={pendingCount > 0}
          onClick={() => navigate('/pending')}
        />
      </div>

      {/* Clients section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-[#111827]">Your Clients</h2>
        <Link to="/clients/new" className="btn-secondary">
          <Plus size={14} />
          Add New Client
        </Link>
      </div>

      {/* Client grid */}
      {loadingClients ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#F3F4F6]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F3F4F6] rounded w-3/4" />
                  <div className="h-3 bg-[#F3F4F6] rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-[#F3F4F6] rounded w-1/4 mb-3" />
              <div className="border-t border-[#F3F4F6] pt-3 grid grid-cols-3 gap-2">
                <div className="h-8 bg-[#F3F4F6] rounded" />
                <div className="h-8 bg-[#F3F4F6] rounded" />
                <div className="h-8 bg-[#F3F4F6] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="card p-12 text-center col-span-2">
          <div className="text-3xl mb-3">🏢</div>
          <div className="text-[15px] font-semibold text-[#111827] mb-1">No clients yet</div>
          <div className="text-[13px] text-[#9CA3AF] mb-4">Add your first client to get started with GMB management.</div>
          <Link to="/clients/new" className="btn-primary inline-flex">
            <Plus size={14} />
            Add New Client
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {clients.map(client => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function ClientCard({ client }) {
  const displayName = clientDisplayName(client);
  const icon = CATEGORY_ICONS[client.category] || CATEGORY_ICONS.Other;

  return (
    <div className="card p-5 hover:shadow-sm transition-shadow">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
          style={{ background: icon.bg }}
        >
          {icon.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[15px] font-semibold text-[#111827] truncate">{displayName}</div>
            <StatusPill status={client.status} />
          </div>
          <div className="text-[12px] text-[#6B7280] mt-0.5">
            {client.category}{client.city ? ` · ${client.city}` : ''}
          </div>
        </div>
      </div>

      <Link
        to={`/clients/${client.id}`}
        className="text-[12px] text-[#2563EB] hover:underline flex items-center gap-0.5 mb-3"
      >
        View Details <ArrowUpRight size={11} />
      </Link>

      <div className="border-t border-[#F3F4F6]" />

      {/* Stats row */}
      <div className="grid grid-cols-3 mt-3 divide-x divide-[#F3F4F6]">
        <div className="text-center">
          <div className="text-[16px] font-semibold text-[#111827]">{client.stats?.posts ?? 0}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF] mt-0.5">Posts</div>
        </div>
        <div className="text-center">
          <div className="text-[16px] font-semibold text-[#111827]">
            {client.stats?.avgRating ? `${client.stats.avgRating}★` : (client.stats?.reviews ?? 0)}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF] mt-0.5">Reviews</div>
        </div>
        <div className="text-center">
          <div className="text-[16px] font-semibold text-[#111827]">{client.stats?.citations ?? 0}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF] mt-0.5">Citations</div>
        </div>
      </div>
    </div>
  );
}
