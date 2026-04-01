type Severity = "high" | "medium" | "low" | "ok";

const styles: Record<Severity, string> = {
  high: "bg-severity-high/15 text-severity-high border-severity-high/30",
  medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  low: "bg-severity-low/15 text-severity-low border-severity-low/30",
  ok: "bg-severity-ok/15 text-severity-ok border-severity-ok/30",
};

interface SeverityBadgeProps {
  severity: Severity;
  children?: React.ReactNode;
}

export default function SeverityBadge({ severity, children }: SeverityBadgeProps) {
  const label = children ?? severity;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[severity]}`}>
      {label}
    </span>
  );
}
