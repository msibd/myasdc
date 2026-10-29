export function Spinner({ size = 18 }: { size?: number }) {
  return <span aria-label="Loading" role="status" className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size }} />;
}

export function PageSkeleton() {
  return <div aria-label="Loading page" className="min-h-screen bg-surface p-5 sm:p-8"><div className="mx-auto max-w-[1400px] animate-pulse space-y-6"><div className="h-5 w-24 rounded bg-slate-200"/><div className="h-9 w-56 rounded bg-slate-200"/><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-2xl bg-white"/><div className="h-28 rounded-2xl bg-white"/><div className="h-28 rounded-2xl bg-white"/></div><div className="h-96 rounded-2xl bg-white"/></div></div>;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return <div aria-label="Loading table" className="animate-pulse divide-y divide-slate-100">{Array.from({ length: rows }).map((_, index) => <div key={index} className="flex items-center gap-4 p-5"><div className="h-10 w-10 rounded-full bg-slate-200"/><div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded bg-slate-200"/><div className="h-2 w-1/2 rounded bg-slate-100"/></div><div className="h-7 w-20 rounded bg-slate-100"/></div>)}</div>;
}
