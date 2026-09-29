import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ChallanPaginationProps {
  currentPage: number;
  totalPages: number;
  filteredCount: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const ChallanPagination = memo(function ChallanPagination({
  currentPage,
  totalPages,
  filteredCount,
  itemsPerPage,
  onPageChange,
}: ChallanPaginationProps) {
  const handlePrevious = useCallback(() => {
    onPageChange(Math.max(1, currentPage - 1));
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    onPageChange(Math.min(totalPages, currentPage + 1));
  }, [currentPage, totalPages, onPageChange]);

  const handlePageClick = useCallback(
    (page: number) => {
      onPageChange(page);
    },
    [onPageChange]
  );

  const startIndex = filteredCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredCount);

  return (
    <div className="flex flex-col gap-4 p-4 border-t sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Showing {startIndex} to {endIndex} of {filteredCount} challans
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={handlePrevious}
          className="transition-colors px-3"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex gap-1 items-center flex-wrap justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            const isCurrentPage = page === currentPage;
            const showPage = Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;

            if (!showPage) return null;

            return (
              <Button
                key={page}
                variant={isCurrentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageClick(page)}
                className="transition-colors min-w-9 px-3"
                aria-label={`Page ${page}`}
                aria-current={isCurrentPage ? "page" : undefined}
              >
                {page}
              </Button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={handleNext}
          className="transition-colors px-3"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export default ChallanPagination;
