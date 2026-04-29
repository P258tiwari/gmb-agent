import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Loader2 } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import CitationCard from '../components/CitationCard';
import api from '../lib/api';

const STATUS_CONFIG = {
  Verified:  { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  Submitted: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Pending:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
};

export default function ClientCitations() {
  const { clientId } = useParams();
  const [client,   setClient]   = useState(null);
  const [citations, setCitations] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg,  setScanMsg]  = useState('');

  useEffect(() => {
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(() => {});
  }, [clientId]);

  const loadCitations = useCallback(() => {
    setLoading(true);
    api.get(`/citations/${clientId}`)
      .then(r => setCitations(r.data))
      .catch(() => setCitations([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadCitations(); }, [loadCitations]);

  const handleScan = async () => {
    setScanning(true);
    setScanMsg('');
    try {
      const res = await api.post(`/citations/${clientId}/scan`);
      setCitations(res.data);
      setScanMsg(`Found ${res.data.length} directories with AI-generated submit instructions`);
    } catch (err) {
      setScanMsg(err.response?.data?.error || 'Scan failed — please try again');
    } finally {
      setScanning(false);
    }
  };

  const handleUpdate = (updated) => {
    setCitations(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const verified  = citations.filter(c => c.status === 'Verified').length;
  const submitted = citations.filter(c => c.status === 'Submitted').length;
  const pending   = citations.filter(c => c.status === 'Pending').length;

  return (
    <ClientLayout client={client}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Citation Building</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            {citations.length > 0
              ? `${citations.length} directories — ${verified} verified, ${submitted} submitted, ${pending} pending`
              : 'Scan to discover listing opportunities'}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn-primary disabled:opacity-60"
        >
          {scanning
            ? <><Loader2 size={13} className="animate-spin" /> Scanning...</>
            : <><RefreshCw size={13} /> Scan Directories</>}
        </button>
      </div>

      {/* Scan feedback */}
      {scanMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[13px] text-[#16A34A]">
          {scanMsg}
        </div>
      )}

      {/* Stats */}
      {citations.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Verified',  val: verified,  cfg: STATUS_CONFIG.Verified  },
            { label: 'Submitted', val: submitted, cfg: STATUS_CONFIG.Submitted },
            { label: 'Pending',   val: pending,   cfg: STATUS_CONFIG.Pending   }
          ].map(({ label, val, cfg }) => (
            <div
              key={label}
              className="card p-4"
              style={{ background: val > 0 ? cfg.bg : undefined, borderColor: val > 0 ? cfg.border : undefined }}
            >
              <div className="text-[20px] font-bold" style={{ color: val > 0 ? cfg.color : '#111827' }}>
                {val}
              </div>
              <div className="text-[12px] text-[#6B7280] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 bg-[#F3F4F6] rounded w-28" />
                  <div className="h-3 bg-[#F3F4F6] rounded w-40" />
                </div>
                <div className="h-5 bg-[#F3F4F6] rounded w-16" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-[#F3F4F6] rounded w-full" />
                <div className="h-3 bg-[#F3F4F6] rounded w-4/5" />
              </div>
              <div className="h-px bg-[#F3F4F6]" />
              <div className="space-y-1.5">
                {[1,2,3,4,5].map(j => (
                  <div key={j} className="h-3 bg-[#F3F4F6] rounded" style={{ width: `${70 + j * 5}%` }} />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                {[1,2,3].map(j => <div key={j} className="flex-1 h-7 bg-[#F3F4F6] rounded-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : citations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-[15px] font-semibold text-[#111827] mb-1">No citations yet</div>
          <p className="text-[13px] text-[#9CA3AF] mb-4">
            Click "Scan Directories" to find relevant listing sites with AI-generated submit instructions.
          </p>
          <button onClick={handleScan} disabled={scanning} className="btn-primary disabled:opacity-60">
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {scanning ? 'Scanning...' : 'Scan Directories'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {citations.map(citation => (
            <CitationCard
              key={citation.id}
              citation={citation}
              clientId={clientId}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
