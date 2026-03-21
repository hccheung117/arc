"use client";;
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/shadcn";
import { isLLMBusy } from '@/hooks/use-llm-lock';
import {
  ArrowUpIcon,
  ImageIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { generateId } from "ai";
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ============================================================================
// Helpers
// ============================================================================

const PromptInputController = createContext(null);
const ProviderAttachmentsContext = createContext(null);

export const usePromptInputController = () => {
  const ctx = useContext(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return ctx;
};

// Optional variants (do NOT throw). Useful for dual-mode components.
const useOptionalPromptInputController = () =>
  useContext(PromptInputController);

export const useProviderAttachments = () => {
  const ctx = useContext(ProviderAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    );
  }
  return ctx;
};

const useOptionalProviderAttachments = () =>
  useContext(ProviderAttachmentsContext);

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  children
}) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const clearInput = useCallback(() => setTextInput(""), []);

  // ----- attachments state (global when wrapped)
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const fileInputRef = useRef(null);
  // oxlint-disable-next-line eslint(no-empty-function)
  const openRef = useRef(() => {});

  const add = useCallback(async (files) => {
    const incoming = [...files];
    if (incoming.length === 0) return;

    const uploaded = await Promise.all(incoming.map(async (file) => {
      const filePath = window.api.getFilePath(file)
      const payload = filePath
        ? { path: filePath, filename: file.name, mediaType: file.type }
        : { data: await file.arrayBuffer(), filename: file.name, mediaType: file.type };
      return window.api.call('message:upload-attachment', payload);
    }));

    setAttachmentFiles((prev) => [
      ...prev,
      ...uploaded.map((att) => ({ ...att, id: generateId(), type: 'file' })),
    ]);
  }, []);

  const remove = useCallback((id) => {
    setAttachmentFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => setAttachmentFiles([]), []);

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo(() => ({
    add,
    clear,
    fileInputRef,
    files: attachmentFiles,
    openFileDialog,
    remove,
  }), [attachmentFiles, add, remove, clear, openFileDialog]);

  const __registerFileInput = useCallback((ref, open) => {
    fileInputRef.current = ref.current;
    openRef.current = open;
  }, []);

  const controller = useMemo(() => ({
    __registerFileInput,
    attachments,
    textInput: {
      clear: clearInput,
      setInput: setTextInput,
      value: textInput,
    },
  }), [textInput, clearInput, attachments, __registerFileInput]);

  return (
    <PromptInputController.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputController.Provider>
  );
};

// ============================================================================
// Component Context & Hooks
// ============================================================================

const LocalAttachmentsContext = createContext(null);

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = useContext(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
};

export const LocalReferencedSourcesContext =
  createContext(null);

export const usePromptInputReferencedSources = () => {
  const ctx = useContext(LocalReferencedSourcesContext);
  if (!ctx) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a LocalReferencedSourcesContext.Provider"
    );
  }
  return ctx;
};

export const PromptInputActionAddAttachments = ({
  label = "Add photos or files",
  ...props
}) => {
  const attachments = usePromptInputAttachments();

  const handleSelect = useCallback((e) => {
    e.preventDefault();
    attachments.openFileDialog();
  }, [attachments]);

  return (
    <DropdownMenuItem {...props} onSelect={handleSelect}>
      <ImageIcon className="mr-2 size-4" /> {label}
    </DropdownMenuItem>
  );
};

export const PromptInput = ({
  className,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  attachmentItems,
  onAttachmentItemsChange,
  children,
  ...props
}) => {
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  // Refs
  const inputRef = useRef(null);
  const formRef = useRef(null);

  // ----- Local attachments (only used when no provider and not controlled)
  const isControlled = attachmentItems !== undefined;
  const [localItems, setLocalItems] = useState([]);
  const items = isControlled ? attachmentItems : localItems;
  const setItems = isControlled ? onAttachmentItemsChange : setLocalItems;
  const files = usingProvider ? controller.attachments.files : items;

  // ----- Local referenced sources (always local to PromptInput)
  const [referencedSources, setReferencedSources] = useState([]);

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback((f) => {
    if (!accept || accept.trim() === "") {
      return true;
    }

    const patterns = accept
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return patterns.some((pattern) => {
      if (pattern.endsWith("/*")) {
        // e.g: image/* -> image/
        const prefix = pattern.slice(0, -1);
        return f.type.startsWith(prefix);
      }
      return f.type === pattern;
    });
  }, [accept]);

  const setItemsRef = useRef(setItems);
  setItemsRef.current = setItems;
  const addLocal = useCallback(async (fileList) => {
    const incoming = [...fileList];
    const accepted = incoming.filter((f) => matchesAccept(f));
    if (incoming.length && accepted.length === 0) {
      onError?.({
        code: "accept",
        message: "No files match the accepted types.",
      });
      return;
    }
    const withinSize = (f) =>
      maxFileSize ? f.size <= maxFileSize : true;
    const sized = accepted.filter(withinSize);
    if (accepted.length > 0 && sized.length === 0) {
      onError?.({
        code: "max_file_size",
        message: "All files exceed the maximum size.",
      });
      return;
    }

    const capacity =
      typeof maxFiles === "number"
        ? Math.max(0, maxFiles - items.length)
        : undefined;
    const capped =
      typeof capacity === "number" ? sized.slice(0, capacity) : sized;
    if (typeof capacity === "number" && sized.length > capacity) {
      onError?.({
        code: "max_files",
        message: "Too many files. Some were not added.",
      });
    }

    const uploaded = await Promise.all(capped.map(async (file) => {
      const filePath = window.api.getFilePath(file)
      const payload = filePath
        ? { path: filePath, filename: file.name, mediaType: file.type }
        : { data: await file.arrayBuffer(), filename: file.name, mediaType: file.type };
      return window.api.call('message:upload-attachment', payload);
    }));

    setItemsRef.current((prev) => [
      ...prev,
      ...uploaded.map((att) => ({ ...att, id: generateId(), type: 'file' })),
    ]);
  }, [matchesAccept, maxFiles, maxFileSize, onError, items.length]);

  const removeLocal = useCallback((id) =>
    setItemsRef.current((prev) => prev.filter((file) => file.id !== id)), []);

  // Wrapper that validates files before calling provider's add
  const addWithProviderValidation = useCallback(async (fileList) => {
    const incoming = [...fileList];
    const accepted = incoming.filter((f) => matchesAccept(f));
    if (incoming.length && accepted.length === 0) {
      onError?.({
        code: "accept",
        message: "No files match the accepted types.",
      });
      return;
    }
    const withinSize = (f) =>
      maxFileSize ? f.size <= maxFileSize : true;
    const sized = accepted.filter(withinSize);
    if (accepted.length > 0 && sized.length === 0) {
      onError?.({
        code: "max_file_size",
        message: "All files exceed the maximum size.",
      });
      return;
    }

    const currentCount = files.length;
    const capacity =
      typeof maxFiles === "number"
        ? Math.max(0, maxFiles - currentCount)
        : undefined;
    const capped =
      typeof capacity === "number" ? sized.slice(0, capacity) : sized;
    if (typeof capacity === "number" && sized.length > capacity) {
      onError?.({
        code: "max_files",
        message: "Too many files. Some were not added.",
      });
    }

    if (capped.length > 0) {
      await controller?.attachments.add(capped);
    }
  }, [matchesAccept, maxFileSize, maxFiles, onError, files.length, controller]);

  const clearAttachments = useCallback(() =>
    usingProvider
      ? controller?.attachments.clear()
      : setItems([]), [usingProvider, controller]);

  const clearReferencedSources = useCallback(() => setReferencedSources([]), []);

  const add = usingProvider ? addWithProviderValidation : addLocal;
  const remove = usingProvider ? controller.attachments.remove : removeLocal;
  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  const clear = useCallback(() => {
    clearAttachments();
    clearReferencedSources();
  }, [clearAttachments, clearReferencedSources]);

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) {
      return;
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    if (globalDrop) {
      // when global drop is on, let the document-level handler own drops
      return;
    }

    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }

    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange = useCallback((event) => {
    if (event.currentTarget.files) {
      add(event.currentTarget.files);
    }
    // Reset input value to allow selecting files that were previously removed
    event.currentTarget.value = "";
  }, [add]);

  const attachmentsCtx = useMemo(() => ({
    add,
    clear: clearAttachments,
    fileInputRef: inputRef,
    files: files.map((item) => ({ ...item, id: item.id })),
    openFileDialog,
    remove,
  }), [files, add, remove, clearAttachments, openFileDialog]);

  const refsCtx = useMemo(() => ({
    add: (incoming) => {
      const array = Array.isArray(incoming) ? incoming : [incoming];
      setReferencedSources((prev) => [
        ...prev,
        ...array.map((s) => ({ ...s, id: generateId() })),
      ]);
    },
    clear: clearReferencedSources,
    remove: (id) => {
      setReferencedSources((prev) => prev.filter((s) => s.id !== id));
    },
    sources: referencedSources,
  }), [referencedSources, clearReferencedSources]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const text = usingProvider
      ? controller.textInput.value
      : (() => {
          const formData = new FormData(form);
          return (formData.get("message")) || "";
        })();

    if (!usingProvider) {
      form.reset();
    }

    try {
      const attachments = files.map(({ id: _id, ...att }) => att)
      const result = onSubmit({ files: attachments, attachments, text }, event);

      // Handle both sync and async onSubmit
      if (result instanceof Promise) {
        try {
          await result;
          clear();
          if (usingProvider) {
            controller.textInput.clear();
          }
        } catch {
          // Don't clear on error - user may want to retry
        }
      } else {
        // Sync function completed without throwing, clear inputs
        clear();
        if (usingProvider) {
          controller.textInput.clear();
        }
      }
    } catch {
      // Don't clear on error - user may want to retry
    }
  }, [usingProvider, controller, files, onSubmit, clear]);

  // Render with or without local provider
  const inner = (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file" />
      <form
        className={cn("flex min-h-0 w-full flex-col", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}>
        <InputGroup className="min-h-0 overflow-hidden rounded-2xl">{children}</InputGroup>
      </form>
    </>
  );

  const withReferencedSources = (
    <LocalReferencedSourcesContext.Provider value={refsCtx}>
      {inner}
    </LocalReferencedSourcesContext.Provider>
  );

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext.Provider value={attachmentsCtx}>
      {withReferencedSources}
    </LocalAttachmentsContext.Provider>
  );
};

export const PromptInputBody = ({
  className,
  ...props
}) => (
  <div className={cn("contents", className)} {...props} />
);

export const PromptInputTextarea = ({
  onChange,
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}) => {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = useCallback((e) => {
    // Call the external onKeyDown handler first
    onKeyDown?.(e);

    // If the external handler prevented default, don't run internal logic
    if (e.defaultPrevented) {
      return;
    }

    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      // Check if the submit button is disabled before submitting
      const { form } = e.currentTarget;
      const submitButton = form?.querySelector('button[type="submit"]');
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }

    // Remove last attachment when Backspace is pressed and textarea is empty
    if (
      e.key === "Backspace" &&
      e.currentTarget.value === "" &&
      attachments.files.length > 0
    ) {
      e.preventDefault();
      const lastAttachment = attachments.files.at(-1);
      if (lastAttachment) {
        attachments.remove(lastAttachment.id);
      }
    }
  }, [onKeyDown, isComposing, attachments]);

  const handlePaste = useCallback((event) => {
    const items = event.clipboardData?.items;

    if (!items) {
      return;
    }

    const files = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      attachments.add(files);
    }
  }, [attachments]);

  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);

  const controlledProps = controller
    ? {
        onChange: (e) => {
          controller.textInput.setInput(e.currentTarget.value);
          onChange?.(e);
        },
        value: controller.textInput.value,
      }
    : {
        onChange,
      };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-0", className)}
      name="message"
      onCompositionEnd={handleCompositionEnd}
      onCompositionStart={handleCompositionStart}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      {...controlledProps} />
  );
};

export const PromptInputHeader = ({
  className,
  ...props
}) => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props} />
);

export const PromptInputFooter = ({
  className,
  ...props
}) => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props} />
);

export const PromptInputTools = ({
  className,
  ...props
}) => (
  <div className={cn("flex min-w-0 items-center gap-1", className)} {...props} />
);

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  tooltip,
  ...props
}) => {
  const newSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  const button = (
    <InputGroupButton
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props} />
  );

  if (!tooltip) {
    return button;
  }

  const tooltipContent =
    typeof tooltip === "string" ? tooltip : tooltip.content;
  const shortcut = typeof tooltip === "string" ? undefined : tooltip.shortcut;
  const side = typeof tooltip === "string" ? "top" : (tooltip.side ?? "top");

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={side}>
        {tooltipContent}
        {shortcut && (
          <span className="ml-2 text-muted-foreground">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export const PromptInputActionMenu = (props) => (
  <DropdownMenu {...props} />
);

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}) => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export const PromptInputActionMenuContent = ({
  className,
  ...props
}) => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

export const PromptInputActionMenuItem = ({
  className,
  ...props
}) => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}) => {
  const isGenerating = isLLMBusy(status);

  let Icon = <ArrowUpIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Spinner />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback((e) => {
    if (isGenerating && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    onClick?.(e);
  }, [isGenerating, onStop, onClick]);

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}>
      {children ?? Icon}
    </InputGroupButton>
  );
};

export const PromptInputSelect = (props) => (
  <Select {...props} />
);

export const PromptInputSelectTrigger = ({
  className,
  ...props
}) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props} />
);

export const PromptInputSelectContent = ({
  className,
  ...props
}) => (
  <SelectContent className={cn(className)} {...props} />
);

export const PromptInputSelectItem = ({
  className,
  ...props
}) => (
  <SelectItem className={cn(className)} {...props} />
);

export const PromptInputSelectValue = ({
  className,
  ...props
}) => (
  <SelectValue className={cn(className)} {...props} />
);

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export const PromptInputHoverCardTrigger = (
  props
) => <HoverCardTrigger {...props} />;

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}) => (
  <HoverCardContent align={align} {...props} />
);

export const PromptInputTabsList = ({
  className,
  ...props
}) => <div className={cn(className)} {...props} />;

export const PromptInputTab = ({
  className,
  ...props
}) => <div className={cn(className)} {...props} />;

export const PromptInputTabLabel = ({
  className,
  ...props
}) => (
  // Content provided via children in props
  // oxlint-disable-next-line eslint-plugin-jsx-a11y(heading-has-content)
  (<h3
    className={cn("mb-2 px-3 font-medium text-muted-foreground text-xs", className)}
    {...props} />)
);

export const PromptInputTabBody = ({
  className,
  ...props
}) => (
  <div className={cn("space-y-1", className)} {...props} />
);

export const PromptInputTabItem = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent", className)}
    {...props} />
);

export const PromptInputCommand = ({
  className,
  ...props
}) => <Command className={cn(className)} {...props} />;

export const PromptInputCommandInput = ({
  className,
  ...props
}) => (
  <CommandInput className={cn(className)} {...props} />
);

export const PromptInputCommandList = ({
  className,
  ...props
}) => (
  <CommandList className={cn(className)} {...props} />
);

export const PromptInputCommandEmpty = ({
  className,
  ...props
}) => (
  <CommandEmpty className={cn(className)} {...props} />
);

export const PromptInputCommandGroup = ({
  className,
  ...props
}) => (
  <CommandGroup className={cn(className)} {...props} />
);

export const PromptInputCommandItem = ({
  className,
  ...props
}) => (
  <CommandItem className={cn(className)} {...props} />
);

export const PromptInputCommandSeparator = ({
  className,
  ...props
}) => (
  <CommandSeparator className={cn(className)} {...props} />
);
