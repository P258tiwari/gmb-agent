import { useState, useEffect } from 'react';
import { RefreshCw, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import TagInput from './TagInput';
import ChangesDiff from './ChangesDiff';
import ApprovalModal from './ApprovalModal';
import api from '../lib/api';

const DIFF_FIELDS = [
  { key: 'name',                label: 'Business Name',         type: 'text'  },
  { key: 'primaryCategory',     label: 'Primary Category',      type: 'text'  },
  { key: 'secondaryCategories', label: 'Secondary Categories',  type: 'array' },
  { key: 'description',         label: 'Description',           type: 'text'  },
  { key: 'services',            label: 'Services',              type: 'array' }
];

export default function GbpOptimizationPanel({ clientId, clientData }) {
  // idle | loading | fetched | error
  const [fetchStatus, setFetchStatus] = useState('idle');
  // idle | loading | done | error
  const [optimizeStatus, setOptimizeStatus] = useState('idle');
  // idle | loading | success | error
  const [updateStatus, setUpdateStatus] = useState('idle');

  const [currentProfile,  setCurrentProfile]  = useState(null);
  const [proposedChanges, setProposedChanges] = useState(null);
  const [editedChanges,   setEditedChanges]   = useState({});
  const [showModal,       setShowModal]        = useState(false);
  const [fetchError,      setFetchError]       = useState('');
  const [optimizeError,   setOptimizeError]    = useState('');
  const [updateError,     setUpdateError]      = useState('');

  useEffect(() => { loadStatus(); }, [clientId]);

  async function loadStatus() {
    try {
      const { data } = await api.get(`/clients/${clientId}/gbp/status`);
      if (data.gbpProfile) {
        setCurrentProfile(data.gbpProfile);
        setFetchStatus('fetched');
      }
      if (data.pendingGbpUpdate?.status === 'pending') {
        const p = data.pendingGbpUpdate.proposedChanges || {};
        setProposedChanges(p);
        setEditedChanges(p);
        setOptimizeStatus('done');
      } else if (data.pendingGbpUpdate?.status === 'approved') {
        setUpdateStatus('success');
      }
    } catch { /* silent — new clients have no status yet */ }
  }

  async function handleFetch() {
    setFetchStatus('loading');
    setFetchError('');
    try {
      const { data } = await api.post(`/clients/${clientId}/gbp/fetch`);
      setCurrentProfile(data);
      setFetchStatus('fetched');
    } catch (err) {
      setFetchStatus('error');
      setFetchError(err.response?.data?.error || 'Failed to fetch GBP profile');
    }
  }

  async function handleOptimize() {
    setOptimizeStatus('loading');
    setOptimizeError('');
    try {
      const { data } = await api.post(`/clients/${clientId}/gbp/optimize`);
      const p = data.proposedChanges || {};
      setProposedChanges(p);
      setEditedChanges(p);
      setOptimizeStatus('done');
    } catch (err) {
      setOptimizeStatus('error');
      setOptimizeError(err.response?.data?.error || 'Failed to generate suggestions');
    }
  }

  async function handleApprove() {
    setShowModal(false);
    setUpdateStatus('loading');
    setUpdateError('');
    try {
      await api.put(`/clients/${clientId}/gbp/approve`, { changes: editedChanges });
      setUpdateStatus('success');
      setOptimizeStatus('idle');
      setProposedChanges(null);
      await loadStatus();
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(err.response?.data?.error || 'Failed to update Google profile');
    }
  }

  async function handleReject() {
    try { await api.put(`/clients/${clientId}/gbp/reject`); } catch {}
    setOptimizeStatus('idle');
    setProposedChanges(null);
    setEditedChanges({});
  }

  const setEdited = (key, val) => setEditedChanges(e => ({ ...e, [key]: val }));
  const descLen = (editedChanges.description || '').length;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
        <div>
          <h3 className="text-[15px] font-semibold text-[#111827]">
            Google Business Profile Optimization
          </h3>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            AI-powered updates to improve Google Maps visibility
          </p>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetchStatus === 'loading'}
          className="btn-secondary disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={fetchStatus === 'loading' ? 'animate-spin' : ''} />
          {fetchStatus === 'loading' ? 'Fetching...' : 'Fetch Current Profile'}
        </button>
      </div>

      <div className="p-6">
        {/* Alerts */}
        {updateStatus === 'success' && (
          <div className="flex items-start gap-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3 mb-5">
            <CheckCircle2 size={16} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-[#15803D]">
                Google Business Profile Updated Successfully
              </div>
              <div className="text-[12px] text-[#16A34A] mt-0.5">
                Changes will be live on Google Maps within 24–48 hours.
              </div>
            </div>
          </div>
        )}

        {fetchStatus === 'error' && (
          <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 mb-5 text-[13px] text-[#DC2626]">
            <AlertCircle size={14} className="flex-shrink-0" />
            {fetchError}
          </div>
        )}

        {optimizeStatus === 'error' && (
          <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 mb-5 text-[13px] text-[#DC2626]">
            <AlertCircle size={14} className="flex-shrink-0" />
            {optimizeError}
          </div>
        )}

        {updateStatus === 'error' && (
          <div className="flex items-center justify-between bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 mb-5">
            <div className="flex items-center gap-2 text-[13px] text-[#DC2626]">
              <AlertCircle size={14} />
              {updateError}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="text-[12px] font-semibold text-[#DC2626] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* STATE: idle */}
        {fetchStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
              <Building2 size={20} className="text-[#9CA3AF]" />
            </div>
            <div className="text-[15px] font-semibold text-[#374151] mb-1">
              No GBP data fetched yet
            </div>
            <div className="text-[13px] text-[#6B7280] mb-5 max-w-xs">
              Connect Google and fetch the current profile to generate AI optimization suggestions.
            </div>
            <button onClick={handleFetch} className="btn-primary">
              Fetch Current Profile →
            </button>
          </div>
        )}

        {/* STATE: loading skeleton */}
        {fetchStatus === 'loading' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-4">
              <RefreshCw size={13} className="animate-spin text-[#2563EB]" />
              Fetching profile from Google...
            </div>
            {[80, 55, 90, 65, 75].map((w, i) => (
              <div
                key={i}
                className="h-4 bg-[#F3F4F6] rounded animate-pulse"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}

        {/* STATE: fetched */}
        {fetchStatus === 'fetched' && currentProfile && (
          <>
            {optimizeStatus === 'done' && proposedChanges ? (
              /* ── Comparison view ────────────────────────── */
              <>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {/* Current profile (read-only) */}
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="text-[12px] font-semibold text-[#374151] mb-0.5">
                      Current Profile
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mb-4">
                      What's live on Google now
                    </div>
                    <div className="space-y-3">
                      <ReadField label="Name" value={currentProfile.name} />
                      <ReadField label="Primary Category" value={currentProfile.primaryCategory} />
                      <ReadField label="Description" value={currentProfile.description} truncate />
                      <ReadField label="Services" value={currentProfile.services} isArray />
                    </div>
                  </div>

                  {/* AI suggested (editable) */}
                  <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4 relative">
                    <span className="absolute top-3 right-3 text-[10px] font-semibold text-white bg-[#2563EB] rounded-full px-2.5 py-0.5">
                      AI Generated
                    </span>
                    <div className="text-[12px] font-semibold text-[#1D4ED8] mb-0.5">
                      AI Suggested Changes
                    </div>
                    <div className="text-[11px] text-[#3B82F6] mb-4">
                      Optimized based on your client information
                    </div>

                    <div className="space-y-3">
                      <EditField
                        label="Name"
                        value={editedChanges.name || ''}
                        original={currentProfile.name}
                        onChange={v => setEdited('name', v)}
                      />
                      <EditField
                        label="Primary Category"
                        value={editedChanges.primaryCategory || ''}
                        original={currentProfile.primaryCategory}
                        onChange={v => setEdited('primaryCategory', v)}
                        helpText="Most relevant Google Maps category"
                      />
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-[#374151]">
                            Description
                          </span>
                          <span className={`text-[10px] font-semibold ${descLen > 700 ? 'text-[#DC2626]' : 'text-[#6B7280]'}`}>
                            {descLen}/750
                          </span>
                        </div>
                        <textarea
                          rows={5}
                          maxLength={750}
                          value={editedChanges.description || ''}
                          onChange={e => setEdited('description', e.target.value)}
                          className="w-full text-[12px] border border-[#BFDBFE] bg-white rounded-md p-2 resize-none focus:outline-none focus:border-[#2563EB] transition-colors"
                        />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-[#374151] mb-1.5">
                          Services
                        </div>
                        <TagInput
                          value={editedChanges.services || []}
                          onChange={v => setEdited('services', v)}
                          placeholder="Add service..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diff summary */}
                <div className="border border-[#E5E7EB] rounded-lg p-4 mb-4">
                  <div className="text-[13px] font-semibold text-[#111827] mb-3">
                    What changes will be made:
                  </div>
                  <ChangesDiff
                    current={currentProfile}
                    proposed={editedChanges}
                    fields={DIFF_FIELDS}
                  />
                </div>

                {/* AI reasoning */}
                {proposedChanges.reasoning && (
                  <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 mb-4">
                    <div className="text-[12px] font-semibold text-[#374151] mb-2">
                      AI Reasoning
                    </div>
                    <div className="space-y-1.5 text-[12px] text-[#6B7280]">
                      {proposedChanges.reasoning.nameChange && (
                        <div>
                          <span className="font-medium text-[#374151]">Name: </span>
                          {proposedChanges.reasoning.nameChange}
                        </div>
                      )}
                      {proposedChanges.reasoning.categoryChoice && (
                        <div>
                          <span className="font-medium text-[#374151]">Category: </span>
                          {proposedChanges.reasoning.categoryChoice}
                        </div>
                      )}
                      {proposedChanges.reasoning.descriptionStrategy && (
                        <div>
                          <span className="font-medium text-[#374151]">Description: </span>
                          {proposedChanges.reasoning.descriptionStrategy}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReject}
                    className="py-2 px-4 text-[13px] font-medium border border-[#DC2626] text-[#DC2626] rounded-lg hover:bg-[#FEF2F2] transition-colors"
                  >
                    ✗ Reject Changes
                  </button>
                  <button
                    onClick={handleOptimize}
                    disabled={optimizeStatus === 'loading'}
                    className="btn-secondary disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={optimizeStatus === 'loading' ? 'animate-spin' : ''} />
                    Regenerate
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    disabled={updateStatus === 'loading'}
                    className="btn-primary disabled:opacity-50 ml-auto"
                  >
                    {updateStatus === 'loading'
                      ? <><RefreshCw size={13} className="animate-spin" /> Updating...</>
                      : 'Review & Approve Changes →'
                    }
                  </button>
                </div>
              </>
            ) : (
              /* ── Profile + generate button ──────────────── */
              <>
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 mb-4">
                  <div className="text-[13px] font-semibold text-[#374151] mb-3">
                    Current GBP Profile
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <ReadField label="Business Name" value={currentProfile.name} />
                    <ReadField label="Primary Category" value={currentProfile.primaryCategory} />
                    <div className="col-span-2">
                      <ReadField label="Description" value={currentProfile.description} truncate />
                    </div>
                    <ReadField label="Services" value={currentProfile.services} isArray />
                    <ReadField
                      label="Secondary Categories"
                      value={currentProfile.secondaryCategories}
                      isArray
                    />
                  </div>
                  {currentProfile.lastFetched && (
                    <div className="text-[11px] text-[#9CA3AF] mt-3">
                      Last fetched:{' '}
                      {new Date(currentProfile.lastFetched).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>

                {optimizeStatus === 'loading' ? (
                  <div className="flex items-center gap-3 py-5 px-4 bg-[#EFF6FF] rounded-lg border border-[#BFDBFE]">
                    <RefreshCw size={16} className="animate-spin text-[#2563EB] flex-shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold text-[#1D4ED8]">
                        Claude is analyzing your business...
                      </div>
                      <div className="text-[12px] text-[#3B82F6] mt-0.5">
                        Optimizing for Google Maps search ranking
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleOptimize} className="w-full btn-primary justify-center py-3">
                    ✨ Generate AI Optimization Suggestions
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <ApprovalModal
        isOpen={showModal}
        onConfirm={handleApprove}
        onCancel={() => setShowModal(false)}
        businessName={clientData?.businessName || clientData?.name}
        changes={editedChanges}
        isLoading={updateStatus === 'loading'}
      />
    </div>
  );
}

function ReadField({ label, value, isArray, truncate }) {
  const display = isArray
    ? ((value || []).join(', ') || '—')
    : (value || '—');
  return (
    <div>
      <div className="text-[11px] text-[#9CA3AF] mb-0.5">{label}</div>
      <div className={`text-[13px] text-[#374151] ${truncate ? 'line-clamp-2' : ''}`}>
        {display}
      </div>
    </div>
  );
}

function EditField({ label, value, original, onChange, helpText }) {
  const changed = value !== (original || '');
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-medium text-[#374151]">{label}</span>
        {changed && (
          <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] rounded-full px-1.5 py-0.5">
            Changed
          </span>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-[12px] border border-[#BFDBFE] bg-white rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#2563EB] transition-colors"
      />
      {helpText && (
        <div className="text-[10px] text-[#6B7280] mt-0.5">{helpText}</div>
      )}
    </div>
  );
}
