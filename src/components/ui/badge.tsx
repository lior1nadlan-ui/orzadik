import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-160 ease-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // --primary/--primary-foreground = 17.8:1; --destructive with white = 7.52:1.
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-card)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-[var(--shadow-card)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/80",
        // Non-interactive label: the hairline is decorative, the text carries
        // the meaning at 17.8:1, so --glass-line is legitimate here.
        outline: "border-glass-line text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
