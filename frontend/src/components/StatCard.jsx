export default function StatCard({ icon: Icon, iconColor = '#6B7280', number, label, sub, subColor, highlight, onClick }) {
  return (
    <div
      className={`card p-5 relative ${highlight ? 'bg-[#EFF6FF] border-[#BFDBFE]' : ''} ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} transition-shadow`}
      onClick={onClick}
    >
      {Icon && (
        <div className="absolute top-5 right-5">
          <Icon size={20} style={{ color: iconColor }} />
        </div>
      )}
      <div className={`text-[32px] font-bold leading-none mb-1 ${highlight ? 'text-[#2563EB]' : 'text-[#111827]'}`}>
        {number}
      </div>
      <div className={`text-[13px] mb-2 ${highlight ? 'text-[#2563EB]' : 'text-[#6B7280]'}`}>{label}</div>
      {sub && (
        <div className="text-[12px]" style={{ color: subColor || '#6B7280' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
