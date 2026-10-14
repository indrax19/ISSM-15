import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";
import type { SiteDetails } from "@/integrations/firebase/siteDetailsAPI";

interface SiteSelectDropdownProps {
  sites: SiteDetails[];
  value: string;
  onChange: (siteId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SiteSelectDropdown({
  sites,
  value,
  onChange,
  placeholder = "Select a site",
  disabled = false,
}: SiteSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSites, setFilteredSites] = useState<SiteDetails[]>(sites);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedSite = sites.find((s) => s.id === value);

  useEffect(() => {
    const filtered = sites.filter((site) => {
      const millName = site.millName || "";
      const siteName = site.siteName || "";
      const query = searchQuery.toLowerCase();
      return millName.toLowerCase().includes(query) || siteName.toLowerCase().includes(query);
    });
    setFilteredSites(filtered);
  }, [searchQuery, sites]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (siteId: string) => {
    onChange(siteId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <span className={selectedSite ? "text-gray-900" : "text-gray-500"}>
          {selectedSite ? selectedSite.millName || "Unnamed Site" : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedSite && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 rounded"
              title="Clear selection"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Sites List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredSites.length === 0 ? (
              <div className="p-3 text-sm text-gray-600 text-center">
                {sites.length === 0 ? "No sites available" : "No sites match your search"}
              </div>
            ) : (
              <div className="space-y-0">
                {filteredSites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => handleSelect(site.id || "")}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-gray-100 last:border-b-0 hover:bg-blue-50 ${
                      value === site.id ? "bg-blue-100 font-semibold text-blue-900" : "text-gray-900"
                    }`}
                  >
                    <div className="font-medium">{site.millName || "Unnamed Site"}</div>
                    {site.siteName && (
                      <div className="text-xs text-gray-600">{site.siteName}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
