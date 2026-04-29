import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Plus, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {});
    api.get('/clients/pending/all').then(r => setPendingCount(r.data.length)).catch(() => {});
  }, []);

  const isActive = (path) => location.pathname === path;
  const isClientActive = (id) => location.pathname.startsWith(`/clients/${id}`);
  const visibleClients = clients.slice(0, 8);
  const hasMore = clients.length > 8;

  return (
    <aside className="w-[220px] min-h-screen bg-white border-r border-[#E5E7EB] flex flex-col fixed left-0 top-0 bottom-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#E5E7EB]">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center flex-shrink-0">
          <Rocket size={16} className="text-white" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#111827] leading-tight">GMB Agent</div>
          <div className="text-[11px] text-[#6B7280]">Ampwake Agency</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-3 space-y-0.5">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" active={isActive('/dashboard') || isActive('/')} />
        <NavItem
          to="/pending"
          icon={CheckSquare}
          label="Pending Approvals"
          active={isActive('/pending')}
          badge={pendingCount > 0 ? pendingCount : null}
        />
      </nav>

      {/* Active Clients */}
      <div className="px-3 mt-2 flex-1 overflow-y-auto">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[#9CA3AF] px-2 mb-2">
          Active Clients
        </div>
        <div className="space-y-0.5">
          {visibleClients.map(client => (
            <button
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] transition-colors ${
                isClientActive(client.id)
                  ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                  : 'text-[#374151] hover:bg-[#F9FAFB]'
              }`}
            >
              {client.businessName || client.name}
            </button>
          ))}
          {hasMore && (
            <Link to="/dashboard" className="block px-2 py-1.5 text-[13px] text-[#2563EB] hover:underline">
              View All Clients
            </Link>
          )}
        </div>
      </div>

      {/* Add Client */}
      <div className="p-3 border-t border-[#E5E7EB]">
        <Link
          to="/clients/new"
          className="flex items-center justify-center gap-2 w-full bg-[#2563EB] text-white rounded-lg py-2 text-[13px] font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={14} />
          Add New Client
        </Link>
      </div>
    </aside>
  );
}

function NavItem({ to, icon: Icon, label, active, badge }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] transition-colors ${
        active
          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
          : 'text-[#374151] hover:bg-[#F9FAFB]'
      }`}
    >
      <Icon size={15} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="bg-[#2563EB] text-white text-[11px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </Link>
  );
}
