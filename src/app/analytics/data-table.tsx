"use client";

import { useState } from "react";
import { columnFilteringFeature, globalFilteringFeature, rowPaginationFeature, rowSortingFeature, tableFeatures, useTable, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";

type TestRow = { id: string; name: string; department: string; orders: number };
const features = tableFeatures({ columnFilteringFeature, globalFilteringFeature, rowPaginationFeature, rowSortingFeature });
const columns: ColumnDef<typeof features, TestRow>[] = [{ accessorKey: "name", header: "Test" }, { accessorKey: "department", header: "Department" }, { accessorKey: "orders", header: "Orders" }];
const emptyRows: TestRow[] = [];

export function AnalyticsDataTable({ data }: { data: TestRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useTable({ features, columns, data: data ?? emptyRows, state: { sorting, pagination, globalFilter }, onSortingChange: setSorting, onPaginationChange: setPagination, onGlobalFilterChange: setGlobalFilter });
  return <div><div className="mb-3 flex items-center justify-between gap-3"><input value={globalFilter} onChange={(event) => table.setGlobalFilter(event.target.value)} placeholder="Filter tests..." aria-label="Filter tests" className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/><span className="text-xs text-slate-400">{table.getFilteredRowModel().rows.length} results</span></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr>{table.getHeaderGroups().map((group) => group.headers.map((header) => <th key={header.id} className="cursor-pointer px-3 py-3" onClick={header.column.getToggleSortingHandler()}>{header.isPlaceholder ? null : <table.FlexRender header={header}/>} {header.column.getIsSorted() ? header.column.getIsSorted() === "asc" ? "↑" : "↓" : ""}</th>))}</tr></thead><tbody className="divide-y divide-slate-100">{table.getRowModel().rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">{row.getAllCells().map((cell) => <td key={cell.id} className="px-3 py-3 text-slate-600"><table.FlexRender cell={cell}/></td>)}</tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between"><button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Previous</button><span className="text-xs text-slate-400">Page {table.state.pagination.pageIndex + 1} of {table.getPageCount() || 1}</span><button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Next</button></div></div>;
}
