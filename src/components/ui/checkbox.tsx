import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Boundary stays --primary (#16181D, 17.8:1 on white) rather than dropping
      // to --input's 3.25:1: a 16px control needs the stronger edge, and checked
      // state is a --primary fill carrying --primary-foreground at 17.8:1.
      // No press/scale here — checkboxes are high-frequency UI, which gets no
      // animation; only the colour swap is transitioned.
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary bg-card/70 shadow-sm transition-colors duration-160 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
