type Status = "open" | "monitoring" | "explained" | "escalated" | "closed";

const styles: Record<Status, string> = {
  open: "bg-census-blue/15 text-census-blue border-census-blue/30",
  monitoring: "bg-severity-low/15 text-severity-low border-severity-low/30",
  explained: "bg-severity-ok/15 text-severity-ok border-severity-ok/30",
  escalated: "bg-severity-high/15 text-severity-high border-severity-high/30",
  closed: "bg-census-gray-200 text-census-gray-600 border-census-gray-300",
};

const icons: Record<Status, string> = {
  open: "\u25CB",
  monitoring: "\u25CE",
  explained: "\u2713",
  escalated: "\u26A0",
  closed: "\u2501",
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const s = status as Status;
  const style = styles[s] || styles.open;
  const icon = icons[s] || "";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      <span>{icon}</span>
      {status}
    </span>
  );
}
