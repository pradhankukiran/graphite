'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-all duration-150',
    'focus-visible:outline-3 focus-visible:outline-[#ffdd00] focus-visible:outline focus-visible:outline-offset-0 focus-visible:ring-0',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-teal text-white hover:bg-teal-hover shadow-[0_2px_0_#002d18] hover:shadow-[0_2px_0_#002d18] active:translate-y-[2px] active:shadow-none',
        secondary: 'bg-[#f3f2f1] text-charcoal shadow-[0_2px_0_#929191] hover:bg-[#dbdad9] active:translate-y-[2px] active:shadow-none',
        outline: 'border border-border bg-surface text-charcoal hover:bg-background hover:border-border',
        ghost: 'text-charcoal-light hover:text-charcoal hover:bg-charcoal/[0.04]',
        danger: 'bg-danger text-white shadow-[0_2px_0_#6a1b0e] hover:bg-danger/90 active:translate-y-[2px] active:shadow-none',
        'danger-ghost': 'text-danger hover:bg-danger/[0.06]',
      },
      size: {
        xs: 'h-8 px-3 text-[13px] gap-1',
        sm: 'h-10 px-4 text-sm',
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
