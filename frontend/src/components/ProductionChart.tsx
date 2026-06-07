import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

interface HourlyData {
  hour: string;
  output: number;
  target: number;
  oee: number;
}

interface Props {
  items: HourlyData[];
  totalOutput?: number;
  avgOee?: number;
  achievementRate?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: 6, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ fontWeight: 600, color: "#333", marginBottom: 4 }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ProductionChart: React.FC<Props> = ({ items, totalOutput, avgOee, achievementRate }) => {
  if (!items || items.length === 0) return null;

  // Show last 12 hours for readability
  const chartData = items.length > 12 ? items.slice(-12) : items;

  return (
    <div>
      {/* Summary badges */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {totalOutput !== undefined && (
          <span style={{ fontSize: 11, color: "#1565c0", backgroundColor: "#e3f2fd", padding: "3px 10px", borderRadius: 12, fontWeight: 500 }}>
            总产量: {totalOutput}
          </span>
        )}
        {avgOee !== undefined && (
          <span style={{ fontSize: 11, color: "#2e7d32", backgroundColor: "#e8f5e9", padding: "3px 10px", borderRadius: 12, fontWeight: 500 }}>
            平均OEE: {avgOee}
          </span>
        )}
        {achievementRate !== undefined && (
          <span style={{ fontSize: 11, color: "#e65100", backgroundColor: "#fff3e0", padding: "3px 10px", borderRadius: 12, fontWeight: 500 }}>
            达成率: {achievementRate}%
          </span>
        )}
      </div>

      {/* Bar chart: Output vs Target */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>小时产量 (最近12小时)</div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, color: "#999" }} interval={1} />
          <YAxis tick={{ fontSize: 10, color: "#999" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey="output" name="实际产量" fill="#1976d2" radius={[2, 2, 0, 0]} />
          <Bar dataKey="target" name="目标产量" fill="#e0e0e0" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Line chart: OEE trend */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginTop: 8, marginBottom: 4 }}>OEE 趋势</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 10, color: "#999" }} interval={1} />
          <YAxis domain={[0, 1.1]} tick={{ fontSize: 10, color: "#999" }} tickFormatter={(v) => v.toFixed(1)} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="oee" name="OEE" stroke="#2e7d32" strokeWidth={2} dot={{ r: 2, fill: "#2e7d32" }} />
          {/* Reference line for 0.70 threshold */}
          <CartesianGrid strokeDasharray="5 5" stroke="#c62828" strokeOpacity={0.3} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 9, color: "#bbb", textAlign: "right", marginTop: 2 }}>红色虚线: OEE=0.70 警戞线</div>
    </div>
  );
};
