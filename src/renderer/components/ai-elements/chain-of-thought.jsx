"use client";;
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/shadcn";
import { WrenchIcon, ChevronDownIcon, DotIcon } from "lucide-react";
import { createContext, memo, useContext, useMemo } from "react";

const ChainOfThoughtContext = createContext(null);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought");
  }
  return context;
};

export const ChainOfThought = memo(({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}) => {
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });

  const chainOfThoughtContext = useMemo(() => ({ isOpen, setIsOpen }), [isOpen, setIsOpen]);

  return (
    <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn("not-prose w-full mb-4", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </ChainOfThoughtContext.Provider>
  );
});

export const ChainOfThoughtHeader = memo(({
  className,
  children,
  ...props
}) => {
  const { isOpen } = useChainOfThought();

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
        className
      )}
      {...props}>
      <WrenchIcon className="size-4" />
      {children ?? "Chain of Thought"}
      <ChevronDownIcon
        className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
    </CollapsibleTrigger>
  );
});

const stepStatusStyles = {
  active: "text-foreground",
  complete: "text-muted-foreground",
  pending: "text-muted-foreground/50",
};

export const ChainOfThoughtStep = memo(({
  className,
  icon: Icon = DotIcon,
  label,
  description,
  status = "complete",
  children,
  ...props
}) => (
  <div
    className={cn(
      "flex gap-2 text-sm",
      stepStatusStyles[status],
      "fade-in-0 slide-in-from-top-2 animate-in",
      className
    )}
    {...props}>
    <div className="relative mt-0.5">
      <Icon className="size-4" />
      <div className="absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border" />
    </div>
    <div className="flex-1 space-y-2 overflow-hidden">
      <div>{label}</div>
      {description && (
        <div className="text-muted-foreground text-xs">{description}</div>
      )}
      {children}
    </div>
  </div>
));

export const ChainOfThoughtSearchResults = memo(({
  className,
  ...props
}) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
));

export const ChainOfThoughtSearchResult = memo(({
  className,
  children,
  ...props
}) => (
  <Badge
    className={cn("gap-1 px-2 py-0.5 font-normal text-xs", className)}
    variant="secondary"
    {...props}>
    {children}
  </Badge>
));

export const ChainOfThoughtContent = memo(({
  className,
  children,
  ...props
}) => {
  return (
    <CollapsibleContent
      className={cn(
        "mt-4 space-y-3",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}>
      {children}
    </CollapsibleContent>
  );
});

export const ChainOfThoughtImage = memo(({
  className,
  children,
  caption,
  ...props
}) => (
  <div className={cn("mt-2 space-y-2", className)} {...props}>
    <div
      className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
      {children}
    </div>
    {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
  </div>
));

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
