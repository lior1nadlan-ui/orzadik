import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // --foreground/10 rather than --primary/10: identical value today, but a
  // placeholder is neutral ink, not a "primary action" surface, so it should not
  // move if --primary is ever re-pointed. animate-pulse stays — a loading
  // placeholder is not rapidly-triggered UI, so the keyframe rule does not apply.
  return <div className={cn("animate-pulse rounded-md bg-foreground/10", className)} {...props} />;
}

export { Skeleton };
