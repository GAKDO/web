import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui Button(new-york). 손가락으로 누르는 폰(375px)에서는 44px, 768px 이상은 40px 높이
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-[15px] font-medium transition-[color,background-color,box-shadow] outline-none cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-brand-hover",
        destructive: "bg-destructive text-white font-semibold shadow-xs hover:bg-destructive/90",
        outline: "border border-input bg-card shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-info underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 md:h-10",
        sm: "h-10 rounded-md px-3 text-sm md:h-9",
        lg: "h-12 rounded-md px-6",
        icon: "size-11 md:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

// React 18이라 ref는 forwardRef로 넘긴다(shadcn/ui 원본은 React 19용)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
