interface FilterPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function FilterPanel({ title = "Context filters", children, className = "" }: FilterPanelProps) {
  return (
    <aside className={`bg-white rounded-lg border border-census-gray-200 shadow-sm p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-census-gray-700 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </aside>
  );
}
