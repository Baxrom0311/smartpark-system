/**
 * Lightweight modal primitive.
 *
 * shadcn/ui's dialog depends on `@radix-ui/react-dialog`, which is not
 * yet installed in this project. To keep the bundle small and avoid
 * pulling in a runtime dependency for a single create form, we ship a
 * minimal accessible modal that supports:
 *
 * - Backdrop click to dismiss
 * - Escape key to dismiss
 * - Focus trap (focuses the first focusable element on open)
 * - Body scroll lock while open
 * - `role="dialog"` + `aria-modal` + labelled title for screen readers
 *
 * If we later need richer behaviour (nested dialogs, async portals,
 * drag-resize), swap this for `@radix-ui/react-dialog` — the public
 * API mirrors shadcn's `<Dialog>` so the call-sites won't change.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional footer slot — usually a row of action buttons. */
  footer?: ReactNode;
  /** Wider variant for forms with multiple columns. */
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus the first focusable element on open and lock body scroll.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const focusable = root?.querySelector<HTMLElement>(
      "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const titleId = "modal-title";
  const descId = description ? "modal-desc" : undefined;

  const node = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      onClick={(e) => {
        // Only close when the backdrop itself is clicked.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "relative z-10 flex w-full flex-col gap-4 rounded-xl border border-brand-200 bg-white p-6 shadow-xl",
          "dark:border-brand-800 dark:bg-brand-900",
          sizeClasses[size],
        )}
      >
        <header className="flex flex-col gap-1.5">
          <h2
            id={titleId}
            className="text-lg font-semibold leading-none tracking-tight text-brand-900 dark:text-brand-100"
          >
            {title}
          </h2>
          {description && (
            <p
              id={descId}
              className="text-sm text-brand-600 dark:text-brand-300"
            >
              {description}
            </p>
          )}
        </header>
        <div className="flex flex-col gap-4">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
