import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw } from "lucide-react";
import { Challan, ChallanType } from "@/integrations/firebase/challanAPI";

interface ChallanPageHeaderProps {
  activeTab: ChallanType;
  onTabChange: (tab: string) => void;
  onCreateNew: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const ChallanPageHeader = memo(function ChallanPageHeader({
  activeTab,
  onTabChange,
  onCreateNew,
  onRefresh,
  isRefreshing = false,
}: ChallanPageHeaderProps) {
  const handleTabChange = useCallback(
    (value: string) => {
      onTabChange(value);
    },
    [onTabChange]
  );

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const activeTabLabel = activeTab === "internal" ? "Internal" : "External";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Delivery Challans
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and view delivery challans
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="icon"
            className="transition-all hover:shadow-md"
            disabled={isRefreshing}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={onCreateNew}
            className="gap-2 flex-1 sm:flex-none justify-center sm:justify-start transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">New Challan</span>
            <span className="hidden sm:inline">New {activeTabLabel} Challan</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 sm:max-w-xl">
          <TabsTrigger value="external" className="px-2 text-xs sm:px-3 sm:text-sm">
            <span className="sm:hidden">External</span>
            <span className="hidden sm:inline">Delivery Challans External</span>
          </TabsTrigger>
          <TabsTrigger value="internal" className="px-2 text-xs sm:px-3 sm:text-sm">
            <span className="sm:hidden">Internal</span>
            <span className="hidden sm:inline">Delivery Challans Internal</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
});

export default ChallanPageHeader;
