import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_COLORS } from "@/lib/colors";

interface StatusData {
  name: string;
  value: number;
  fill: string;
}

interface CategoryWithItems {
  name: string;
  items: number;
}

interface TrendData {
  date: string;
  additions: number;
  removals: number;
}

interface ItemStatusChartProps {
  data: StatusData[];
}

export function ItemStatusChart({ data }: ItemStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200} minWidth={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={window.innerWidth < 768 ? 50 : 80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ItemsByCategoryChartProps {
  data: CategoryWithItems[];
}

export function ItemsByCategoryChart({ data }: ItemsByCategoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200} minWidth={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={60}
          width={60}
          interval={Math.ceil(data.length / 5) - 1}
        />
        <YAxis width={40} />
        <Tooltip />
        <Bar dataKey="items" fill={CHART_COLORS.info} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TransactionTrendChartProps {
  data: TrendData[];
}

export function TransactionTrendChart({ data }: TransactionTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200} minWidth={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis width={40} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="additions"
          stroke={CHART_COLORS.success}
          strokeWidth={2}
          dot={{ fill: CHART_COLORS.success }}
          name="Items Added"
        />
        <Line
          type="monotone"
          dataKey="removals"
          stroke={CHART_COLORS.error}
          strokeWidth={2}
          dot={{ fill: CHART_COLORS.error }}
          name="Items Issued"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
