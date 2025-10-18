import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge } from "@/components/ui/badge";

interface TransactionFiltersProps {
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onSortChange: (sort: string) => void;
  activeFiltersCount?: number;
}

/**
 * Transaction filters with debounced search
 * Extracted from monolithic TransactionsPage for better maintainability
 */
export function TransactionFilters({
  onSearchChange,
  onStatusChange,
  onSortChange,
  activeFiltersCount = 0,
}: TransactionFiltersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Debounce search to reduce API calls
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Trigger search when debounced value changes
  useState(() => {
    onSearchChange(debouncedSearch);
  });

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une transaction..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="grid gap-4 p-4 border rounded-lg bg-card">
          <div className="grid gap-2">
            <Label htmlFor="status-filter">Statut</Label>
            <Select onValueChange={onStatusChange} defaultValue="all">
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="completed">Complété</SelectItem>
                <SelectItem value="expired">Expiré</SelectItem>
                <SelectItem value="disputed">En litige</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sort-filter">Trier par</Label>
            <Select onValueChange={onSortChange} defaultValue="created_at_desc">
              <SelectTrigger id="sort-filter">
                <SelectValue placeholder="Plus récent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">Plus récent</SelectItem>
                <SelectItem value="created_at_asc">Plus ancien</SelectItem>
                <SelectItem value="price_desc">Prix décroissant</SelectItem>
                <SelectItem value="price_asc">Prix croissant</SelectItem>
                <SelectItem value="updated_at_desc">Dernière modification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
