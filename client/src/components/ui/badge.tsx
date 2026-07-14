import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        easy: "border-transparent bg-[#00b8a3]/10 text-[#00987f] dark:bg-[#00b8a3]/15 dark:text-[#2edbc3]",
        medium: "border-transparent bg-[#ffa116]/10 text-[#b86e00] dark:bg-[#ffa116]/15 dark:text-[#ffb84d]",
        hard: "border-transparent bg-[#ff375f]/10 text-[#e01745] dark:bg-[#ff375f]/15 dark:text-[#ff6b8a]",
        mastered: "border-transparent bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
        active: "border-transparent bg-primary/10 text-primary dark:bg-primary/15",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
