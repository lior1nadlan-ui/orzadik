// The admin's detail surface: an order, a customer card, a phone order.
//
// On a phone it is a full-screen sheet — a sticky header with the title and a
// close button that never scrolls away, a body that scrolls on its own, and an
// optional sticky action bar at the bottom, in the thumb's reach. The admins
// run the shop from their phones between customers; the old centred dialog
// was 85% of the screen with the close X scrolling off with the content and
// every action button at the far end of a long scroll.
//
// From sm up it is the same centred modal the panel always had (max-w-2xl,
// capped at 85vh), with the same header/body/footer split, so a long order no
// longer pushes its own title out of view on the computer either.
//
// Built on the Radix dialog directly rather than DialogContent: that one owns
// an absolutely positioned close button inside the scrolling box, which is
// exactly the thing that must not scroll here.

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdminSheet = DialogPrimitive.Root;

type ContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  "title"
> & {
  /** The heading — a string or a node (badges next to the name). */
  title: React.ReactNode;
  /** A line or a row of chips under the title, still inside the sticky header. */
  headerExtra?: React.ReactNode;
  /** The sticky action bar. Leave out for none. */
  footer?: React.ReactNode;
  /** Width from sm up. */
  size?: "md" | "lg";
};

export const AdminSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ContentProps
>(
  (
    { title, headerExtra, footer, size = "lg", className, children, onOpenAutoFocus, ...props },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/55 backdrop-blur-xs transition-opacity duration-260 ease-out starting:opacity-0" />
      <DialogPrimitive.Content
        ref={ref}
        dir="rtl"
        // No Radix description on most sheets: the title says what it is.
        aria-describedby={undefined}
        // Focus the sheet itself, not its first control: on a phone, landing in
        // an input pops the keyboard over the sheet before anything is read, and
        // landing on the close button paints a focus ring nobody asked for.
        onOpenAutoFocus={
          onOpenAutoFocus ??
          ((e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          })
        }
        className={cn(
          "fixed z-50 flex flex-col glass-strong text-foreground outline-none max-sm:[--glass-bg-strong:var(--background)] max-sm:[--glass-radius:0px]",
          // Phone: the whole screen, sliding up from the bottom edge.
          "inset-0 h-[100dvh] transition-[opacity,translate] duration-260 ease-out starting:translate-y-6 starting:opacity-0",
          // sm+: the centred glass modal.
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[85vh] sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:starting:-translate-y-[48%]",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-glass-line bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:rounded-t-[inherit] sm:bg-transparent sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-lg font-semibold leading-snug">
              {title}
            </DialogPrimitive.Title>
            {headerExtra && <div className="mt-2">{headerExtra}</div>}
          </div>
          <DialogPrimitive.Close className="-me-1 -mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground">
            <X className="h-5 w-5" />
            <span className="sr-only">סגירה</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-glass-line bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:rounded-b-[inherit] sm:bg-transparent sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
AdminSheetContent.displayName = "AdminSheetContent";
