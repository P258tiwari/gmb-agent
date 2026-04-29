import { useState, useEffect } from 'react';
import { Search, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function Header() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();

  // null = not fetched yet, { connected, profile } when loaded
  const [agencyGoogle, setAgencyGoogle] = useState(null);

  function loadAgencyStatus() {
    api.get('/gbp/agency/status')
      .then(r => setAgencyGoogle(r.data))
      .catch(() => setAgencyGoogle({ connected: false, profile: null }));
  }

  useEffect(() => { loadAgencyStatus(); }, []);

  // Refresh after returning from Google OAuth redirect
  useEffect(() => {
    if (location.search.includes('google_connected=1')) {
      loadAgencyStatus();
    }
  }, [location.search]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleDisconnect() {
    try { await api.post('/gbp/agency/disconnect'); } catch {}
    setAgencyGoogle({ connected: false, profile: null });
  }

  const profile = agencyGoogle?.profile || {};
  const initials = (profile.name || 'G').charAt(0).toUpperCase();

  return (
    <header
      className="h-[52px] bg-white border-b border-[#E5E7EB] flex items-center px-6"
      style={{ position: 'sticky', top: 0, zIndex: 40 }}
    >
      {/* Search */}
      <div className="relative w-full max-w-[400px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="Search across all clients..."
          className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
        />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2.5">

        {/* Google — connected profile chip */}
        {agencyGoogle?.connected ? (
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-1.5 max-w-[220px]">
            {profile.picture ? (
              <img
                src={profile.picture}
                className="w-6 h-6 rounded-full flex-shrink-0"
                alt={profile.name}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: '#4285F4' }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-[#111827] leading-none truncate">
                {profile.name || 'Google Account'}
              </div>
              {profile.email && (
                <div className="text-[10px] text-[#6B7280] leading-none mt-0.5 truncate">
                  {profile.email}
                </div>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              title="Disconnect Google"
              className="flex-shrink-0 text-[#9CA3AF] hover:text-[#DC2626] transition-colors ml-0.5"
            >
              <X size={12} />
            </button>
          </div>
        ) : agencyGoogle !== null ? (
          /* Google — not connected button */
          <a
            href="/api/auth/google/agency"
            className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors whitespace-nowrap"
          >
            <GoogleIcon />
            Connect Google
          </a>
        ) : null /* loading — render nothing until status resolves */}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
