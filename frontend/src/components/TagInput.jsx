import { useState, useRef } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ value = [], onChange, placeholder = 'Type and press Enter...', helpText }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) { setInput(''); return; }
    onChange([...value, tag]);
    setInput('');
  };

  const removeTag = (tag) => onChange(value.filter(t => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.endsWith(',')) addTag(val.slice(0, -1));
    else setInput(val);
  };

  return (
    <div>
      <div
        className="flex flex-wrap gap-1.5 p-2 min-h-[44px] rounded-lg border border-[#E5E7EB] cursor-text bg-white transition-colors focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB]/20"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <span
            key={tag}
            className="flex items-center gap-1 text-[13px] font-medium text-[#2563EB] rounded-full"
            style={{ background: '#EFF6FF', padding: '4px 8px 4px 12px' }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="text-[#93C5FD] hover:text-[#2563EB] transition-colors flex items-center leading-none"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-[120px] border-none outline-none text-[13px] text-[#111827] placeholder-[#9CA3AF] bg-transparent py-0.5"
          placeholder={value.length === 0 ? placeholder : ''}
        />
      </div>
      {helpText && <p className="text-[11px] text-[#6B7280] mt-1.5">{helpText}</p>}
    </div>
  );
}
