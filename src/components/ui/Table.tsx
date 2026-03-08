import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { clsx } from '../../utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Enable sorting on this column. Provide a function to extract the sortable value. */
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  /** If true, column is sortable using the raw value from sortValue (default: false) */
  sortable?: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  /** Enable built-in sorting (default: true if any column has sortable) */
  sortable?: boolean;
  /** Controlled sort state (optional — if not provided, internal state is used) */
  sortConfig?: SortConfig | null;
  onSort?: (config: SortConfig | null) => void;
  /** Page size for pagination (0 = no pagination, default: 0) */
  pageSize?: number;
  /** Export button label (if set, renders an export button in the header area) */
  exportLabel?: string;
  onExport?: () => void;
  /** Row key extractor (default: index-based) */
  rowKey?: (row: T, index: number) => string | number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Table<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No records found.',
  loading,
  sortable = true,
  sortConfig: controlledSort,
  onSort: controlledOnSort,
  pageSize = 0,
  exportLabel,
  onExport,
  rowKey,
}: TableProps<T>) {
  // Internal sort state (used when not controlled)
  const [internalSort, setInternalSort] = useState<SortConfig | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const setSort = controlledOnSort ?? setInternalSort;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Sorting ─────────────────────────────────────────────────────────────

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue!(a);
      const bVal = col.sortValue!(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        cmp = Number(aVal) - Number(bVal);
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sort.direction === 'desc' ? -cmp : cmp;
    });
  }, [data, sort, columns]);

  // ─── Pagination ──────────────────────────────────────────────────────────

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = pageSize > 0 ? sortedData.slice((safePage - 1) * pageSize, safePage * pageSize) : sortedData;

  // Reset to page 1 when data length changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  // ─── Sort Handler ────────────────────────────────────────────────────────

  function handleSort(col: Column<T>) {
    if (!col.sortable || !col.sortValue) return;
    if (sort?.key === col.key) {
      if (sort.direction === 'asc') {
        setSort({ key: col.key, direction: 'desc' });
      } else {
        setSort(null); // Clear sort on third click
      }
    } else {
      setSort({ key: col.key, direction: 'asc' });
    }
  }

  function SortIcon({ col }: { col: Column<T> }) {
    if (!col.sortable || !col.sortValue) return null;
    if (sort?.key === col.key) {
      return sort.direction === 'asc'
        ? <ChevronUp size={12} className="text-brand-600" />
        : <ChevronDown size={12} className="text-brand-600" />;
    }
    return <ChevronsUpDown size={12} className="text-gray-300" />;
  }

  // ─── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Export button row */}
      {(exportLabel && onExport) && (
        <div className="flex justify-end px-4 py-2 border-b border-gray-100">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <Download size={13} />
            {exportLabel}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map(col => {
                const isSortable = sortable && col.sortable && col.sortValue;
                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && handleSort(col)}
                    className={clsx(
                      'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                      isSortable && 'cursor-pointer hover:text-gray-700 select-none',
                      col.headerClassName,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      <SortIcon col={col} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">{emptyMessage}</td>
              </tr>
            ) : (
              paginatedData.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  onClick={() => onRowClick?.(row)}
                  className={clsx('hover:bg-gray-50 transition-colors', onRowClick && 'cursor-pointer')}
                >
                  {columns.map(col => (
                    <td key={col.key} className={clsx('px-4 py-3 text-gray-700', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, sortedData.length)} of {sortedData.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safePage <= 4) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safePage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={clsx(
                    'w-7 h-7 rounded-lg text-xs font-medium',
                    pageNum === safePage ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
