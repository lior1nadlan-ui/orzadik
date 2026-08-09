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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-body font-semibold transition-[color,background-color,border-color,box-shadow,transform,scale] duration-160 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-safe:active:scale-[0.97] focus-visible:active:transform-none focus-visible:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
      // SIZE — the 44px touch floor is now the DEFAULT, not an exception a
      // surface has to opt into.
      //
      // WHAT WAS WRONG. `default` was h-9 = 36px, 8px under the WCAG 2.5.5 /
      // Apple HIG 44px target, and it is what almost every control in the shop
      // renders as. The homepage had already refused it: BTN_BASE in
      // src/routes/index.tsx hand-rolls `min-h-[3.25rem]` (52px) with a comment
      // explaining that rem keeps the control growing under the accessibility
      // widget's font-size zoom. That reasoning was correct and it was stranded
      // on one route — 98 of 215 homepage controls were still under 44px, and
      // every other route had no 44px control at all. Both halves of BTN_BASE
      // are adopted here: the sizes, and the min-h-in-rem technique.
      //
      // min-h, NOT h. A fixed `h-9` clips its own label when the a11y widget
      // raises the root font size (the label grows, the box does not); min-h
      // lets the control grow with it, which is the property BTN_BASE was
      // written to get. Vertical centring is unaffected — the base class is
      // already `inline-flex items-center`.
      //
      // Literal rem rather than the spacing scale so `lg` is greppably the SAME
      // string as BTN_BASE's, and so a reader can check the arithmetic against
      // the 44px floor without knowing --spacing.
      size: {
        default: "min-h-[2.75rem] px-4 py-2",  // 44px — the floor, everywhere
        // 40px. `sm` is the admin-density variant: 40 of its 43 call sites are
        // /admin.* table rows and toolbars, where 44 adds ~4px to every row of a
        // 25-row table. 32 -> 40 clears WCAG 2.5.8 (24px) with 16px to spare and
        // stays a visibly distinct step from the default. The three
        // customer-facing call sites (track.tsx x2, account.tsx) gain 8px.
        sm: "min-h-[2.5rem] px-3 text-meta",
        // 52px — byte-identical to BTN_BASE, so the homepage's primary CTAs stop
        // being a bespoke control and become `size="lg"`.
        lg: "min-h-[3.25rem] px-8",
        // Square, and fixed rather than min-: an icon button holds a 16px glyph
        // that does not reflow, so there is nothing for min-h to make room for.
        icon: "h-11 w-11",
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
