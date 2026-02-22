import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/shadcn";

export const ModelSelector = (props) => (
  <Dialog {...props} />
);

export const ModelSelectorTrigger = (props) => (
  <DialogTrigger {...props} />
);

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
  ...props
}) => (
  <DialogContent
    aria-describedby={undefined}
    className={cn("outline! border-none! p-0 outline-border! outline-solid!", className)}
    {...props}>
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command className="**:data-[slot=command-input-wrapper]:h-auto">
      {children}
    </Command>
  </DialogContent>
);

export const ModelSelectorDialog = (props) => (
  <CommandDialog {...props} />
);

export const ModelSelectorInput = ({
  className,
  ...props
}) => (
  <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
);

export const ModelSelectorList = (props) => (
  <CommandList {...props} />
);

export const ModelSelectorEmpty = (props) => (
  <CommandEmpty {...props} />
);

export const ModelSelectorGroup = (props) => (
  <CommandGroup {...props} />
);

export const ModelSelectorItem = ({ className, ...props }) => (
  <CommandItem className={cn("group/item", className)} {...props} />
);

export const ModelSelectorShortcut = (props) => (
  <CommandShortcut {...props} />
);

export const ModelSelectorSeparator = (props) => (
  <CommandSeparator {...props} />
);

export const ModelSelectorLogo = ({
  provider,
  className,
  ...props
}) => (
  <img
    {...props}
    alt={`${provider} logo`}
    className={cn("size-4 dark:invert", className)}
    height={16}
    src={`https://models.dev/logos/${provider}.svg`}
    width={16} />
);

export const ModelSelectorLogoGroup = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:bg-background [&>img]:p-px [&>img]:ring-1 dark:[&>img]:bg-foreground",
      className
    )}
    {...props} />
);

export const ModelSelectorName = ({
  className,
  ...props
}) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
);

export const ModelSelectorFavorite = ({
  active,
  className,
  onClick,
  ...props
}) => (
  <button
    type="button"
    className={cn(
      "ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100 hover:opacity-100",
      active && "opacity-100",
      className
    )}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    {...props}>
    <StarIcon
      className={cn("size-4", active ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
  </button>
);
