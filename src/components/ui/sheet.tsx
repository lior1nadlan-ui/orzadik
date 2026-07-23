"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-foreground/55 backdrop-blur-xs transition-opacity duration-380 ease-drawer starting:opacity-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// This drives the LIVE mobile nav drawer (SiteHeader, side="right").
//
// The old base carried a bare `transition` (a broad property list) plus an
// explicit `ease-in-out` — the standard forbids ease-in on UI, and drawers get
// --ease-drawer at 380ms. The slide-in/out KEYFRAME utilities are gone: entry is
// now an interruptible transition on translate + opacity.
//
// Deliberate asymmetry: the off-screen offset exists ONLY as a `starting:`
// value. Putting it in a normal rule would risk a drawer stuck off-screen if
// @starting-style ever loses a cascade tie; this way the worst case is a drawer
// that appears with no slide.
const sheetVariants = cva(
  "fixed z-50 gap-4 glass-strong [--glass-radius:0px] p-6 transition-[opacity,transform,translate] duration-380 ease-drawer starting:opacity-0",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 starting:-translate-y-full",
        bottom: "inset-x-0 bottom-0 starting:translate-y-full",
        left: "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm starting:-translate-x-full",
        right: "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm starting:translate-x-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full p-1 opacity-70 ring-offset-background transition-[opacity,background-color] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
