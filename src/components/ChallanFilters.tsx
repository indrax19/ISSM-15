import { memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChallanFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterDate: string;
  onFilterDateChange: (date: string) => void;
}

const ChallanFilters = memo(function ChallanFilters({
  searchTerm,
  onSearchChange,
  filterDate,
  onFilterDateChange,
}: ChallanFiltersProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterDateChange(e.target.value);
    },
    [onFilterDateChange]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="search" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="search"
              placeholder="Search by challan no, customer, or PO..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="date-filter" className="text-sm font-medium">
              Filter by Date
            </label>
            <Input
              id="date-filter"
              type="date"
              value={filterDate}
              onChange={handleDateChange}
              className="transition-colors"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ChallanFilters;
