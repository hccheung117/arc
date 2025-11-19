import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea component with responsive typography.
 *
 * Typography: Uses text-base (16px) on mobile to prevent iOS auto-zoom when focused.
 * On desktop (md breakpoint), switches to text-label (15px) for a more compact UI
 * that matches other interactive elements like buttons and navigation.
 *
 * @see tailwind.config.js - Typography scale definition
 * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-label",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
