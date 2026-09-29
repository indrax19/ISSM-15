import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Calendar, Users, CheckCircle, AlertCircle, Clock, Zap } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { PROJECT_STATUS_COLORS, CHART_COLORS } from "@/lib/colors";

interface ProjectDashboardProps {
  sites: any[];
}

const COLORS = {
  "Complete": CHART_COLORS.success,
  "Completed": CHART_COLORS.success,
  "In Progress": CHART_COLORS.info,
  "Partially Completed": CHART_COLORS.warning,
  "Not Yet Started": CHART_COLORS.error,
};

const STATUS_ICONS = {
  "Complete": <CheckCircle className="h-4 w-4" />,
  "Completed": <CheckCircle className="h-4 w-4" />,
  "In Progress": <Clock className="h-4 w-4" />,
  "Partially Completed": <AlertCircle className="h-4 w-4" />,
  "Not Yet Started": <AlertCircle className="h-4 w-4" />,
};

export default function ProjectDashboard({ sites }: ProjectDashboardProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalSites = sites.length;
    const statusCounts = sites.reduce((acc, site) => {
      const status = site.projectStatus || "Not Yet Started";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedSites = (statusCounts["Complete"] || 0) + (statusCounts["Completed"] || 0);
    const completionPercentage = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;

    // Calculate project duration
    let startDate = null;
    let endDate = null;
    sites.forEach((site) => {
      if (site.startDate) {
        const siteStart = parseISO(site.startDate);
        if (!startDate || siteStart < startDate) startDate = siteStart;
      }
      if (site.endDate) {
        const siteEnd = parseISO(site.endDate);
        if (!endDate || siteEnd > endDate) endDate = siteEnd;
      }
    });

    let daysRemaining = null;
    if (endDate) {
      const now = new Date();
      daysRemaining = differenceInDays(endDate, now);
    }

    // Team members
    const teamMembers = new Set<string>();
    const supervisors = new Set<string>();
    sites.forEach((site) => {
      if (site.supervisorName) supervisors.add(site.supervisorName);
      if (site.technicianNames) {
        site.technicianNames.forEach((tech: string) => teamMembers.add(tech));
      }
    });

    return {
      totalSites,
      statusCounts,
      completionPercentage,
      completedSites,
      startDate,
      endDate,
      daysRemaining,
      teamSize: supervisors.size + teamMembers.size,
    };
  }, [sites]);

  // Prepare chart data
  const statusChartData = Object.entries(stats.statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
    color: COLORS[status as keyof typeof COLORS] || "#6b7280",
  }));

  const teamChartData = [
    {
      status: "Completed",
      count: stats.completedSites,
    },
    {
      status: "In Progress",
      count: stats.totalSites - stats.completedSites,
    },
  ];

  const getStatusColor = (status: string) => {
    const statusKey = status.toLowerCase().replace(/\s+/g, "-") as keyof typeof PROJECT_STATUS_COLORS;
    const statusColor = PROJECT_STATUS_COLORS[statusKey];
    return statusColor ? `${statusColor.bg} ${statusColor.text}` : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSites}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedSites} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionPercentage}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3 dark:bg-gray-700">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${stats.completionPercentage}%`, backgroundColor: CHART_COLORS.success }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        {statusChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Site Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value} site${value !== 1 ? "s" : ""}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Completion Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Completion</span>
                <span className="text-sm font-bold">{stats.completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                <div
                  className="bg-gradient-to-r from-blue-600 to-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Status Breakdown</h4>
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {STATUS_ICONS[status as keyof typeof STATUS_ICONS]}
                    <span className="text-sm">{status}</span>
                  </div>
                  <Badge className={getStatusColor(status)}>
                    {count} site{count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
