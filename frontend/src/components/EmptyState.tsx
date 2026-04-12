interface EmptyStateProps {
  title: string
  description: string
}

export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="rounded-panel border border-dashed border-black/10 bg-mist p-8 text-center">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{description}</p>
    </div>
  )
}
