"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// MOTION — Emil standard. The shadcn defaults here were tw-animate-css
// keyframe utilities (animate-in / zoom-in-95 / slide-in-from-*). Keyframes are
// one-shot and cannot be reversed mid-flight, which is exactly wrong for a
// surface a user can open and close in quick succession, so they are replaced
// by an interruptible transition on opacity + scale. transform-origin follows
// the trigger via Radix own variable. Only the HIDDEN value lives in
// `starting:`, so a browser without @starting-style degrades to "no animation"
// rather than to "permanently invisible".

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground origin-(--radix-tooltip-content-transform-origin) transition-[opacity,transform,scale,translate] duration-160 ease-out starting:opacity-0 starting:scale-95",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
