import { LineChart, Line, ResponsiveContainer, ReferenceLine } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  benchmark?: number;
}

export default function Sparkline({ data, color = "#002e5d", height = 32, benchmark }: SparklineProps) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points}>
        {benchmark != null && (
          <ReferenceLine y={benchmark} stroke="#9e9e9e" strokeDasharray="3 3" />
        )}
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
