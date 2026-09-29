import { LayoutDashboard, FolderOpen, ScanBarcode, FileCheck2, History, Package, Users, Truck, Settings, MapPin, Shield, CheckSquare, BookOpen, Receipt, AlertCircle, ClipboardList, Building2, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUnresolvedComplaintsCount } from "@/hooks/useUnresolvedComplaintsCount";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
  adminOnly?: boolean;
  activePaths?: string[];
};

type NavGroup = {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
};

const dashboardItem: NavItem = {
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard,
  permission: "dashboard",
};

const navGroups: NavGroup[] = [
  {
    title: "Operations",
    icon: Package,
    items: [
      { title: "Inventory", url: "/categories", icon: FolderOpen, permission: "inventory", activePaths: ["/inventory"] },
      { title: "Scan", url: "/scan", icon: ScanBarcode, permission: "scan" },
      { title: "Personal Inventory", url: "/personal-inventory", icon: Users, permission: "personal-inventory" },
      { title: "Delivery Challans", url: "/delivery-challans", icon: Truck, permission: "delivery-challans" },
      { title: "Invoices", url: "/invoices", icon: Receipt, permission: "invoices" },
    ],
  },
  {
    title: "Projects & Services",
    icon: CheckSquare,
    items: [
      { title: "Projects Tracking", url: "/projects", icon: CheckSquare, permission: "project-tracking", activePaths: ["/project-tracking", "/project-sites"] },
      { title: "SLA", url: "/sla", icon: FileCheck2, permission: "sla", activePaths: ["/sla-sub-projects"] },
      { title: "Technical Details", url: "/sites", icon: MapPin, permission: "sites", activePaths: ["/technical-projects", "/certificates"] },
    ],
  },
  {
    title: "Customers",
    icon: Building2,
    items: [
      { title: "Customer Data", url: "/customer-data", icon: Users, permission: "customer-data" },
      { title: "Outreach Mill", url: "/outreach-mill", icon: Building2, permission: "outreach-mill" },
      { title: "Survey Reports", url: "/survey-reports", icon: ClipboardList, permission: "survey-reports" },
    ],
  },
  {
    title: "Support",
    icon: AlertCircle,
    items: [
      { title: "Support Tickets", url: "/complaints", icon: AlertCircle, permission: "complaints" },
      { title: "Knowledge Base", url: "/knowledge-base", icon: BookOpen },
    ],
  },
  {
    title: "Transactions",
    icon: History,
    items: [
      { title: "Transactions", url: "/transactions", icon: History, permission: "transactions" },
    ],
  },
  {
    title: "Administration",
    icon: Shield,
    items: [
      { title: "Manage Users", url: "/manage-users", icon: Shield, adminOnly: true },
      { title: "Company Profiles", url: "/settings", icon: Settings, permission: "settings" },
      { title: "Profile", url: "/profile", icon: Users, adminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const { isAdmin, appUser } = useAuth();
  const location = useLocation();
  const unresolvedComplaintsCount = useUnresolvedComplaintsCount();
  const collapsed = state === "collapsed" && !isMobile;
  const canAccessItem = (item: NavItem) =>
    isAdmin || (!item.adminOnly && (!item.permission || appUser?.permissions?.includes(item.permission)));
  const matchesPath = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isItemActive = (item: NavItem) => [item.url, ...(item.activePaths || [])].some(matchesPath);
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter(canAccessItem) }))
    .filter((group) => group.items.length > 0);
  const activeGroupTitle = visibleGroups.find((group) => group.items.some(isItemActive))?.title;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeGroupTitle) {
      setExpandedGroups((current) => ({ ...current, [activeGroupTitle]: true }));
    }
  }, [activeGroupTitle, location.pathname]);

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleGroupToggle = (title: string) => {
    if (collapsed) {
      setExpandedGroups((current) => ({ ...current, [title]: true }));
      toggleSidebar();
      return;
    }
    setExpandedGroups((current) => ({ ...current, [title]: !current[title] }));
  };

  const renderNavItem = (item: NavItem) => {
    const active = isItemActive(item);
    return (
      <SidebarMenuItem key={item.title} className="ml-3 border-l border-slate-700 pl-2">
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={collapsed ? item.title : undefined}
          className={`h-9 rounded-lg px-3 text-slate-200 transition-all duration-200 hover:bg-slate-700/50 hover:text-white ${active ? "bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white shadow-md" : ""}`}
        >
          <NavLink to={item.url} end={item.url === "/"} onClick={handleNavClick}>
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="text-sm">{item.title}</span>}
            {!collapsed && expandedGroups.Support && item.title === "Support Tickets" && unresolvedComplaintsCount > 0 && (
              <Badge variant="destructive" className="ml-auto h-5 min-w-5 rounded-full bg-red-500 p-0 text-xs font-bold hover:bg-red-600">
                {unresolvedComplaintsCount > 99 ? "99+" : unresolvedComplaintsCount}
              </Badge>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-700 bg-gradient-to-b from-slate-900 to-slate-800">
      <SidebarHeader className="border-b border-slate-700 px-4 py-3">
        <Link to="/" onClick={handleNavClick} className="flex cursor-pointer items-center gap-3 transition-all duration-200 hover:opacity-90">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Avira Technologies</span>
              <span className="text-xs text-slate-300">Project Management</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-1 py-2">
        {canAccessItem(dashboardItem) && (
          <SidebarGroup className="px-2 py-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive(dashboardItem)}
                  tooltip={collapsed ? dashboardItem.title : undefined}
                  className={`h-10 rounded-lg px-3 text-slate-200 transition-all duration-200 hover:bg-slate-700/50 hover:text-white ${isItemActive(dashboardItem) ? "bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white shadow-md" : ""}`}
                >
                  <NavLink to={dashboardItem.url} end onClick={handleNavClick}>
                    <dashboardItem.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-sm">Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {visibleGroups.map((group) => {
          const groupIsActive = group.items.some(isItemActive);
          const isExpanded = Boolean(expandedGroups[group.title]);
          return (
            <SidebarGroup key={group.title} className="px-2 py-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={groupIsActive}
                    aria-expanded={!collapsed && isExpanded}
                    aria-controls={`sidebar-group-${group.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                    tooltip={collapsed ? group.title : undefined}
                    onClick={() => handleGroupToggle(group.title)}
                    className={`h-9 rounded-lg px-3 text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-white ${groupIsActive ? "bg-slate-700/70 text-white" : ""}`}
                  >
                    <group.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-sm font-semibold">{group.title}</span>}
                    {!collapsed && group.title === "Support" && !isExpanded && unresolvedComplaintsCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 rounded-full bg-red-500 p-0 text-xs font-bold hover:bg-red-600">
                        {unresolvedComplaintsCount > 99 ? "99+" : unresolvedComplaintsCount}
                      </Badge>
                    )}
                    {!collapsed && <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />}
                  </SidebarMenuButton>
                  {!collapsed && isExpanded && (
                    <SidebarGroupContent
                      id={`sidebar-group-${group.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                      className="mt-1"
                    >
                      <SidebarMenu className="gap-1">
                        {group.items.map(renderNavItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
