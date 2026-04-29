import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import api from '../lib/api';

const TABS = [
  { key: 'transactional', label: 'Transactional', desc: 'Buy / book / hire intent' },
  { key: 'nearMe',        label: 'Near-me',        desc: 'Local & proximity searches' },
  { key: 'informational', label: 'Informational',  desc: 'Education & how-to queries' },
  { key: 'hindi',         label: 'Hindi',          desc: 'Devanagari language keywords' }
];

export default function ClientKeywords() {
  const { clientId } = useParams();
  const [client,       setClient]       = useState(null);
  const [keywords,     setKeywords]     = useState({ transactional: [], nearMe: [], informational: [], hindi: [] });
  const [loading,      setLoading]      = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab,    setActiveTab]    = useState('transactional');
  const [copiedIdx,    setCopiedIdx]    = useState(null);
  const [copiedAll,    setCopiedAll]    = useState(false);
  const [regenMsg,     setRegenMsg]     = useState('');
  const [regenError,   setRegenError]   = useState('');

  useEffect(() => {
    api.get(`/clients/${clientId}`).then(r => setClient(r.data)).catch(() => {});
  }, [clientId]);

  const loadKeywords = useCallback(() => {
    setLoading(true);
    api.get(`/keywords/${clientId}`)
      .then(r => setKeywords(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { loadKeywords(); }, [loadKeywords]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenMsg('');
    setRegenError('');
    try {
      const res = await api.post(`/keywords/${clientId}/regenerate`);
      setKeywords(res.data);
      const total = Object.values(res.data).flat().length;
      setRegenMsg(`✓ Generated ${total} keywords across 4 categories`);
    } catch (err) {
      const raw = err.response?.data?.error || err.message || '';
      if (raw.includes('credit') || raw.includes('billing') || err.response?.status === 402) {
        setRegenError('Anthropic API credits exhausted — top up at console.anthropic.com → Plans & Billing.');
      } else if (raw.includes('API key') || err.response?.status === 401) {
        setRegenError('Invalid Anthropic API key — check ANTHROPIC_API_KEY in your .env file.');
      } else {
        setRegenError(raw || 'Keyword generation failed. Please try again.');
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const handleCopyAll = () => {
    const kws = keywords[activeTab] || [];
    navigator.clipboard.writeText(kws.join('\n')).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const totalKeywords = Object.values(keywords).flat().length;
  const currentKws    = keywords[activeTab] || [];

  return (
    <ClientLayout client={client}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827]">Local Keywords</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            {totalKeywords > 0
              ? `${totalKeywords} keywords across 4 categories`
              : 'Click Regenerate to generate keywords with AI'}
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="btn-primary disabled:opacity-60"
        >
          {regenerating
            ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
            : <><RefreshCw size={13} /> Regenerate</>}
        </button>
      </div>

      {/* Success feedback */}
      {regenMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[13px] text-[#16A34A]">
          {regenMsg}
        </div>
      )}

      {/* Error feedback */}
      {regenError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[13px] text-[#DC2626] flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5">⚠️</span>
          <span>{regenError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB] mb-5">
        <div className="flex gap-0">
          {TABS.map(tab => {
            const count = (keywords[tab.key] || []).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-[13px] font-medium transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                    : 'text-[#6B7280] hover:text-[#374151] border-b-2 border-transparent'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="ml-1.5 text-[11px] font-normal rounded-full px-1.5"
                    style={{
                      background: activeTab === tab.key ? '#EFF6FF' : '#F3F4F6',
                      color:      activeTab === tab.key ? '#2563EB' : '#9CA3AF'
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab description + Copy All */}
      {currentKws.length > 0 && !loading && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] text-[#6B7280]">
            {TABS.find(t => t.key === activeTab)?.desc}
          </p>
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#374151] transition-colors"
          >
            {copiedAll ? <Check size={12} className="text-[#16A34A]" /> : <Copy size={12} />}
            {copiedAll ? 'Copied!' : 'Copy all'}
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-8 bg-[#F3F4F6] rounded-full animate-pulse"
              style={{ width: `${80 + (i % 5) * 20}px` }}
            />
          ))}
        </div>
      ) : currentKws.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-[15px] font-semibold text-[#111827] mb-1">No keywords yet</div>
          <p className="text-[13px] text-[#9CA3AF] mb-4">
            Click "Regenerate" to generate 40 AI-powered local SEO keywords.
          </p>
          <button onClick={handleRegenerate} disabled={regenerating} className="btn-primary disabled:opacity-60">
            {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {regenerating ? 'Generating...' : 'Generate Keywords'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {currentKws.map((kw, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border border-[#E5E7EB] rounded-full text-[13px] text-[#374151] hover:border-[#2563EB] hover:bg-[#EFF6FF] group transition-colors cursor-default"
              style={{ padding: '7px 14px' }}
            >
              <span className="group-hover:text-[#2563EB] transition-colors">{kw}</span>
              <button
                onClick={() => handleCopy(kw, i)}
                className="text-[#9CA3AF] group-hover:text-[#2563EB] transition-colors flex-shrink-0"
                title="Copy keyword"
              >
                {copiedIdx === i
                  ? <Check size={12} className="text-[#16A34A]" />
                  : <Copy size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
