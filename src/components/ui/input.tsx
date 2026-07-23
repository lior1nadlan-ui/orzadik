import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // `bg-transparent` made the field disappear on a glass panel. A 70%
          // white fill reads as an inset well on the light ground. The boundary
          // stays on --input (#868FA2, 3.25:1 white / 3.06:1 ground) — the
          // WCAG 1.4.11 control boundary; do not lighten it back.
          "flex h-9 w-full rounded-lg border border-input bg-card/70 px-3 py-1 text-base shadow-sm transition-[color,background-color,border-color,box-shadow] duration-160 ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
