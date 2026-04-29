import { ArrowRight } from 'lucide-react';

export default function ChangesDiff({ current = {}, proposed = {}, fields = [] }) {
  return (
    <div className="space-y-0">
      {fields.map((field, idx) => {
        const cur = current[field.key];
        const pro = proposed[field.key];
        const isArray = field.type === 'array';

        const same = isArray
          ? JSON.stringify(cur ?? []) === JSON.stringify(pro ?? [])
          : (cur ?? '') === (pro ?? '');

        if (same) {
          return (
            <div
              key={field.key}
              className={`flex items-start gap-3 py-2.5 text-[13px] ${idx > 0 ? 'border-t border-[#F3F4F6]' : ''}`}
            >
              <div className="w-[148px] flex-shrink-0 text-[12px] font-medium text-[#9CA3AF]">{field.label}</div>
              <div className="text-[12px] text-[#9CA3AF] italic">No change</div>
            </div>
          );
        }

        return (
          <div
            key={field.key}
            className={`py-3 ${idx > 0 ? 'border-t border-[#F3F4F6]' : ''}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[12px] font-semibold text-[#374151]">{field.label}</div>
              <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] rounded-full px-2 py-0.5">
                Changed
              </span>
            </div>

            {isArray ? (
              <div className="flex flex-wrap gap-1.5">
                {(cur || []).filter(v => !(pro || []).includes(v)).map(v => (
                  <span key={v} className="text-[12px] rounded-full px-2.5 py-0.5 line-through"
                    style={{ background: '#FEF2F2', color: '#DC2626' }}>
                    − {v}
                  </span>
                ))}
                {(cur || []).filter(v => (pro || []).includes(v)).map(v => (
                  <span key={v} className="text-[12px] rounded-full px-2.5 py-0.5"
                    style={{ background: '#F3F4F6', color: '#374151' }}>
                    {v}
                  </span>
                ))}
                {(pro || []).filter(v => !(cur || []).includes(v)).map(v => (
                  <span key={v} className="text-[12px] rounded-full px-2.5 py-0.5"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>
                    + {v}
                  </span>
                ))}
                {!(cur || []).length && !(pro || []).length && (
                  <span className="text-[12px] text-[#9CA3AF] italic">—</span>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex-1 text-[12px] rounded-md break-words"
                  style={{ background: '#FEF2F2', color: '#DC2626', padding: '6px 10px' }}>
                  <span className="line-through">{cur || '(empty)'}</span>
                </div>
                <ArrowRight size={14} className="text-[#9CA3AF] flex-shrink-0 mt-1.5" />
                <div className="flex-1 text-[12px] rounded-md break-words"
                  style={{ background: '#F0FDF4', color: '#16A34A', padding: '6px 10px' }}>
                  {pro || '(empty)'}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
