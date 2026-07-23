import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// MOTION — Emil standard.
//   * The transition list is NAMED, never `all`. Tailwind v4 emits `scale-*` to
//     the standalone `scale` property (not `transform`), so `scale` has to be in
//     the list or the press would snap.
//   * Press is scale(0.97) / 160ms / ease-out, and it is `motion-safe:` gated so
//     a reduced-motion user simply never gets the rule.
//   * Keyboard activation must never animate: the `focus-visible:active:` pair
//     is (0,3,0) and outranks the (0,2,0) press rule in both the v3-style
//     (`transform`) and v4-style (`scale`) worlds.
//   * EVERY variant hover is gated behind (hover:hover) and (pointer:fine).
//     Ungated, a tap on a phone leaves the hover colour stuck on the button
//     until the next tap elsewhere — the classic sticky-hover bug. Written out
//     literally on each variant because Tailwind scans source text for class
//     candidates: a shared `const HOVER = "..."` prefix would never be emitted.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[15px] font-semibold transition-[color,background-color,border-color,box-shadow,transform,scale] duration-160 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-safe:active:scale-[0.97] focus-visible:active:transform-none focus-visible:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // --accent (#7E611E) on white = 5.81:1; --accent-strong (#6B5219) = 7.38:1.
        // Never `bg-accent/90`, which composites to 4.66:1 with no headroom.
        default:
          "bg-accent text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong",
        destructive:
          "bg-destructive text-destructive-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/90",
        // Hairline glass outline. The boundary is --input (#868FA2), the token
        // documented at 3.25:1 on white / 3.06:1 on the ground — it clears WCAG
        // 1.4.11 for icon-only outline buttons (admin row actions, carousel
        // arrows), which a --border or --glass-line hairline would not.
        outline:
          "border border-input bg-card/70 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary/80",
        ghost:
          "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-secondary-foreground",
        link: "text-accent underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
