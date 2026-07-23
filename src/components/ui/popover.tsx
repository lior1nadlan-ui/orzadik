import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

// MOTION — Emil standard. The shadcn defaults here were tw-animate-css
// keyframe utilities (animate-in / zoom-in-95 / slide-in-from-*). Keyframes are
// one-shot and cannot be reversed mid-flight, which is exactly wrong for a
// surface a user can open and close in quick succession, so they are replaced
// by an interruptible transition on opacity + scale. transform-origin follows
// the trigger via Radix own variable. Only the HIDDEN value lives in
// `starting:`, so a browser without @starting-style degrades to "no animation"
// rather than to "permanently invisible".

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none origin-(--radix-popover-content-transform-origin) transition-[opacity,transform,scale,translate] duration-200 ease-out starting:opacity-0 starting:scale-95",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
