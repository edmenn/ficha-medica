export default function RecordDetailLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-32 rounded bg-slate-800" />
      <div className="h-64 rounded-xl bg-slate-800" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-800" />
        </div>
      ))}
    </div>
  )
}
