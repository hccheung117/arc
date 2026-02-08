/**
 * Full-window overlay shown during file drag operations.
 *
 * Typography: Uses text-subtitle (20px) for main instruction,
 * text-label (15px) for hint text.
 */
export function DropOverlay({ isVisible, icon: Icon, title, description }) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/50 bg-background/90 p-12">
        <Icon className="h-16 w-16 text-primary" />
        <div className="text-center">
          <p className="text-subtitle font-medium text-foreground">{title}</p>
          <p className="text-label text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
