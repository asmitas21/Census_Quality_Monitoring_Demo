interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "chart" | "table";
  rows?: number;
}

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <div className="h-4 bg-census-gray-200 rounded animate-pulse" style={{ width }} />;
}

export default function Skeleton({ className = "", variant = "text", rows = 3 }: SkeletonProps) {
  if (variant === "card") {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-census-gray-200 p-4 space-y-3 ${className}`}>
        <div className="h-5 w-1/3 bg-census-gray-200 rounded animate-pulse" />
        <div className="h-8 w-1/2 bg-census-gray-200 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-census-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-census-gray-200 p-4 ${className}`}>
        <div className="h-5 w-1/4 bg-census-gray-200 rounded animate-pulse mb-4" />
        <div className="h-48 bg-census-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-census-gray-200 overflow-hidden ${className}`}>
        <div className="bg-census-gray-100 px-4 py-3 flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 flex-1 bg-census-gray-200 rounded animate-pulse" />
          ))}
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex gap-4 border-t border-census-gray-200">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-4 flex-1 bg-census-gray-200 rounded animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <SkeletonLine key={i} width={i === rows - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}
