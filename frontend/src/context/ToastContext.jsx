import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: Check,
  error:   AlertCircle,
  info:    Info
};

const STYLES = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', text: '#15803D' },
  error:   { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', text: '#B91C1C' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', text: '#1D4ED8' }
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const style = STYLES[toast.type] || STYLES.info;
  const Icon  = ICONS[toast.type]  || Info;

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);
    // Animate out just before removal
    const t2 = setTimeout(() => setVisible(false), toast.duration - 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast.duration]);

  return (
    <div
      onClick={() => onRemove(toast.id)}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border shadow-md cursor-pointer select-none"
      style={{
        background:   style.bg,
        borderColor:  style.border,
        maxWidth:     '360px',
        opacity:      visible ? 1 : 0,
        transform:    visible ? 'translateX(0)' : 'translateX(24px)',
        transition:   'opacity 0.25s ease, transform 0.25s ease'
      }}
    >
      <Icon size={15} style={{ color: style.icon, flexShrink: 0, marginTop: '1px' }} />
      <span style={{ fontSize: '13px', color: style.text, lineHeight: '1.5' }}>
        {toast.message}
      </span>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {/* Toast portal — fixed top-right */}
      <div
        className="fixed z-[100] flex flex-col gap-2"
        style={{ top: '20px', right: '20px' }}
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const fn = useContext(ToastContext);
  if (!fn) throw new Error('useToast must be used inside ToastProvider');
  return fn;
}
