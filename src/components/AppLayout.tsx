import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useComplaintNotifications } from "@/hooks/useComplaintNotifications";

export function AppLayout() {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useComplaintNotifications();

  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sm:h-14 flex items-center justify-between border-b bg-white shadow-sm px-2 sm:px-4 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <SidebarTrigger className="h-8 w-8 sm:h-10 sm:w-10" />
              <Link
                to="/"
                className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate"
              >
                Project Management Portal
              </Link>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200 shadow-sm text-xs sm:text-sm font-medium"
              title="Logout"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </header>
          <main ref={mainRef} className="flex-1 overflow-auto overflow-x-auto p-2 sm:p-4 md:p-6">
            <Outlet />
          </main>
          <footer className="border-t bg-card py-2 px-2 sm:px-4 md:px-6">
            <div className="flex flex-col items-center justify-center text-[8px] sm:text-[10px] text-muted-foreground gap-0.5 sm:gap-1">
              <span>© 2026 Avira Technologies. All rights reserved.</span>
              <span className="font-medium bg-muted px-2 py-0.5 rounded-full">
                V 4.1.5
              </span>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
