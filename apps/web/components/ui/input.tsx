import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input component with responsive typography.
 *
 * Typography: Uses text-base (16px) on mobile to prevent iOS auto-zoom when focused.
 * On desktop (md breakpoint), switches to text-label (15px) for compact UI consistency
 * with buttons, navigation, and other interactive elements.
 *
 * Note: File input text uses text-sm (kept as-is for browser chrome compatibility).
 *
 * @see tailwind.config.js - Typography scale definition
 * @see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/AdjustingtheTextSize/AdjustingtheTextSize.html
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-label",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
