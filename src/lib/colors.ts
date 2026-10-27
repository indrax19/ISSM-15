/**
 * Centralized color system for the application
 * All colors should be referenced from this file to maintain consistency
 */

// Brand colors
export const BRAND_COLORS = {
  primary: "#273C70", // Brand primary blue
  accent: "#EA1726", // Brand accent red
  light: "#f8fbff",
  lighter: "#eef4ff",
} as const;

// Status colors with background and text variants
export const STATUS_COLORS = {
  open: {
    bg: "bg-status-open/10",
    text: "text-status-open",
    badge: "bg-status-open/20 text-status-open",
    color: "#f59e0b", // Amber/Yellow
  },
  "in-progress": {
    bg: "bg-status-in-progress/10",
    text: "text-status-in-progress",
    badge: "bg-status-in-progress/20 text-status-in-progress",
    color: "#3b82f6", // Blue
  },
  waiting: {
    bg: "bg-status-waiting/10",
    text: "text-status-waiting",
    badge: "bg-status-waiting/20 text-status-waiting",
    color: "#a855f7", // Purple
  },
  pending: {
    bg: "bg-status-pending/10",
    text: "text-status-pending",
    badge: "bg-status-pending/20 text-status-pending",
    color: "#f97316", // Orange
  },
  "on-hold": {
    bg: "bg-status-on-hold/10",
    text: "text-status-on-hold",
    badge: "bg-status-on-hold/20 text-status-on-hold",
    color: "#8b5cf6", // Purple
  },
  resolved: {
    bg: "bg-status-resolved/10",
    text: "text-status-resolved",
    badge: "bg-status-resolved/20 text-status-resolved",
    color: "#10b981", // Green
  },
  completed: {
    bg: "bg-status-completed/10",
    text: "text-status-completed",
    badge: "bg-status-completed/20 text-status-completed",
    color: "#10b981", // Green
  },
  "client-not-available": {
    bg: "bg-red-100",
    text: "text-red-800",
    badge: "bg-red-100 text-red-800",
    color: "#ef4444", // Red
  },
} as const;

// Project status colors
export const PROJECT_STATUS_COLORS = {
  "complete": {
    bg: "bg-green-100",
    text: "text-green-800",
    color: "#10b981",
    label: "Complete",
  },
  "completed": {
    bg: "bg-green-100",
    text: "text-green-800",
    color: "#10b981",
    label: "Completed",
  },
  "in-progress": {
    bg: "bg-blue-100",
    text: "text-blue-800",
    color: "#3b82f6",
    label: "In Progress",
  },
  "partially-completed": {
    bg: "bg-amber-100",
    text: "text-amber-800",
    color: "#f59e0b",
    label: "Partially Completed",
  },
  "not-yet-started": {
    bg: "bg-red-100",
    text: "text-red-800",
    color: "#ef4444",
    label: "Not Yet Started",
  },
} as const;

// Inventory/Stock status colors
export const INVENTORY_STATUS_COLORS = {
  "in-stock": {
    bg: "bg-green-100",
    text: "text-green-800",
    color: "#10b981",
    label: "In Stock",
  },
  "issued-out": {
    bg: "bg-red-100",
    text: "text-red-800",
    color: "#ef4444",
    label: "Issued Out",
  },
  "low-stock": {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    color: "#f59e0b",
    label: "Low Stock",
  },
  "out-of-stock": {
    bg: "bg-gray-100",
    text: "text-gray-800",
    color: "#6b7280",
    label: "Out of Stock",
  },
} as const;

// Chart colors (for recharts and other charting libraries)
export const CHART_COLORS = {
  primary: "#273C70",
  accent: "#EA1726",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  pending: "#8b5cf6",
  secondary: "#6366f1",
} as const;

// Utility function to get status badge classes
export const getStatusBadgeClasses = (
  status: keyof typeof STATUS_COLORS
): string => {
  return STATUS_COLORS[status].badge;
};

// Utility function to get status color for charts
export const getStatusChartColor = (
  status: keyof typeof STATUS_COLORS
): string => {
  return STATUS_COLORS[status].color;
};

// Utility function to get project status color
export const getProjectStatusColor = (
  status: string
): (typeof PROJECT_STATUS_COLORS)[keyof typeof PROJECT_STATUS_COLORS] => {
  const key = status.toLowerCase().replace(/\s+/g, "-") as keyof typeof PROJECT_STATUS_COLORS;
  return PROJECT_STATUS_COLORS[key] || PROJECT_STATUS_COLORS["not-yet-started"];
};

// Utility function to get inventory status color
export const getInventoryStatusColor = (
  status: keyof typeof INVENTORY_STATUS_COLORS
): (typeof INVENTORY_STATUS_COLORS)[keyof typeof INVENTORY_STATUS_COLORS] => {
  return INVENTORY_STATUS_COLORS[status] || INVENTORY_STATUS_COLORS["out-of-stock"];
};
