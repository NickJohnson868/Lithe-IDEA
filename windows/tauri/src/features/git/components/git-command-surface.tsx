import type { KeyboardEventHandler, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import Command, { CommandHeader, CommandHeaderBadge, CommandInput } from "@/ui/command";
import { Popover, PopoverContent } from "@/ui/popover";

interface GitCommandSurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder: string;
  meta?: ReactNode;
  headerAddon?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  children: ReactNode;
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

const GitCommandSurface = ({
  isOpen,
  onClose,
  query,
  onQueryChange,
  onInputKeyDown,
  placeholder,
  meta,
  headerAddon,
  inputRef,
  children,
  anchorRef,
}: GitCommandSurfaceProps) => {
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  useEffect(() => {
    if (!isOpen) return;

    const frame = requestAnimationFrame(() => {
      resolvedInputRef.current?.focus();
      resolvedInputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, resolvedInputRef]);

  const content = (
    <>
      <CommandHeader onClose={onClose}>
        <CommandInput
          ref={resolvedInputRef}
          value={query}
          onChange={onQueryChange}
          onKeyDown={onInputKeyDown}
          placeholder={placeholder}
          className="font-sans"
        />
        {meta ? <CommandHeaderBadge>{meta}</CommandHeaderBadge> : null}
      </CommandHeader>
      {headerAddon}
      {children}
    </>
  );
  return anchorRef ? (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverContent
        anchor={anchorRef}
        align="start"
        className="git-branch-popup w-[min(480px,calc(100vw-16px))] gap-0 overflow-hidden bg-popover p-0"
      >
        {content}
      </PopoverContent>
    </Popover>
  ) : (
    <Command isVisible={isOpen} onClose={onClose}>
      {content}
    </Command>
  );
};

export default GitCommandSurface;
