import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

// MOTION — Emil standard. The shadcn defaults here were tw-animate-css
// keyframe utilities (animate-in / zoom-in-95 / slide-in-from-*). Keyframes are
// one-shot and cannot be reversed mid-flight, which is exactly wrong for a
// surface a user can open and close in quick succession, so they are replaced
// by an interruptible transition on opacity + scale. transform-origin follows
// the trigger via Radix own variable. Only the HIDDEN value lives in
// `starting:`, so a browser without @starting-style degrades to "no animation"
// rather than to "permanently invisible".

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none origin-(--radix-hover-card-content-transform-origin) transition-[opacity,transform,scale,translate] duration-200 ease-out starting:opacity-0 starting:scale-95",
      className,
    )}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
