import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart2, FileText, Star, Link as LinkIcon, Key, TrendingUp, Trash2, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

export default function ClientSidebar({ client }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const base      = `/clients/${client?.id}`;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const navItems = [
    { to: base, label: 'Overview', icon: BarChart2 },
    { to: `${base}/content`, label: 'Content', icon: FileText },
    { to: `${base}/reviews`, label: 'Reviews', icon: Star },
    { to: `${base}/citations`, label: 'Citations', icon: LinkIcon },
    { to: `${base}/keywords`, label: 'Keywords', icon: Key },
    { to: `${base}/reports`, label: 'Reports', icon: TrendingUp },
  ];

  const isActive = (to) => {
    if (to === base) return location.pathname === base;
    return location.pathname.startsWith(to);
  };

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/clients/${client.id}`);
      navigate('/dashboard');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <aside className="w-[200px] min-h-screen bg-white border-r border-[#E5E7EB] flex flex-col fixed left-[220px] top-0 bottom-0 z-20">
      <div className="px-4 py-4 border-b border-[#E5E7EB]">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-[12px] text-[#6B7280] hover:text-[#374151] flex items-center gap-1 mb-3 transition-colors"
        >
          ← Back to All Clients
        </button>
        <div className="text-[15px] font-semibold text-[#2563EB] leading-tight truncate">
          {client?.businessName || client?.name}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span className="text-[11px] font-medium text-[#16A34A]">Connected</span>
        </div>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors ${
              isActive(to)
                ? 'text-[#2563EB] font-semibold bg-[#EFF6FF] border-l-[3px] border-[#2563EB]'
                : 'text-[#374151] hover:bg-[#F9FAFB] border-l-[3px] border-transparent'
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Delete client — bottom of sidebar */}
      <div className="px-4 pb-5 pt-3 border-t border-[#F3F4F6]">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF] hover:text-[#DC2626] transition-colors w-full"
          >
            <Trash2 size={12} />
            Delete Client
          </button>
        ) : (
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
            <div className="flex items-start gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#DC2626] leading-snug">
                Delete all local data? This does <strong>not</strong> affect the live GBP profile.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-[11px] font-semibold bg-[#DC2626] text-white rounded px-2 py-1.5 hover:bg-[#B91C1C] disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 text-[11px] text-[#374151] border border-[#E5E7EB] rounded px-2 py-1.5 hover:bg-[#F9FAFB] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
