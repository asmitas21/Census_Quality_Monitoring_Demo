interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ title, children, className = "", onClick }: CardProps) {
  return (
    <div 
      className={`bg-slate-800/50 rounded-xl border border-white/5 overflow-hidden transition-all hover:border-white/10 ${className} ${onClick ? 'cursor-pointer hover:bg-slate-800' : ''}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {title && (
        <div className="px-4 py-3 border-b border-white/5 bg-slate-900/30">
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
