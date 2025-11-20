import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea component with responsive typography.
 *
 * Typography: Uses text-label (15px) for a consistent, compact UI that matches
 * other interactive elements like buttons and navigation.
 *
 * Note: Responsive typography (text-base on mobile) has been removed as this is
 * a desktop-first application.
 *
 * @see tailwind.config.js - Typography scale definition
 * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-label shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
