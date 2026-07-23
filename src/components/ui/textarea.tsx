import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Matches Input: 70% white inset well, --input boundary at 3.25:1.
          "flex min-h-[60px] w-full rounded-lg border border-input bg-card/70 px-3 py-2 text-base shadow-sm transition-[color,background-color,border-color,box-shadow] duration-160 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
