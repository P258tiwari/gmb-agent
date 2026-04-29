import { AlertCircle, Check, RefreshCw } from 'lucide-react';

const FIELD_LABELS = {
  name: 'Business Name',
  primaryCategory: 'Primary Category',
  secondaryCategories: 'Secondary Categories',
  description: 'Description',
  services: 'Services'
};

export default function ApprovalModal({ isOpen, onConfirm, onCancel, businessName, changes = {}, isLoading }) {
  if (!isOpen) return null;

  const changedFields = Object.keys(changes)
    .filter(k => k !== 'reasoning' && changes[k] !== undefined && changes[k] !== null)
    .map(k => FIELD_LABELS[k] || k);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-[12px] border border-[#E5E7EB] w-full max-w-[500px] p-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
            <AlertCircle size={24} className="text-[#2563EB]" />
          </div>
          <h2 className="text-[18px] font-bold text-[#111827] mb-2">Update Google Business Profile?</h2>
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            This will update{' '}
            <span className="font-semibold text-[#111827]">{businessName}</span>'s live profile
            on Google Maps. Changes go live within 24–48 hours.
          </p>
        </div>

        {/* Fields being changed */}
        {changedFields.length > 0 && (
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 mb-6">
            <div className="text-[12px] font-semibold text-[#374151] mb-2">Fields being updated:</div>
            <ul className="space-y-1.5">
              {changedFields.map(label => (
                <li key={label} className="flex items-center gap-2 text-[13px] text-[#374151]">
                  <Check size={12} className="text-[#16A34A] flex-shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 btn-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 text-[13px] font-medium bg-[#16A34A] text-white rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading
              ? <><RefreshCw size={13} className="animate-spin" /> Updating...</>
              : <><Check size={13} /> Yes, Update Google Profile</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
