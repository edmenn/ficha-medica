export default function RecordsLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-xl bg-slate-800 p-4">
          <div className="mb-2 h-4 w-1/3 rounded bg-slate-700" />
          <div className="h-3 w-1/2 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  )
}
