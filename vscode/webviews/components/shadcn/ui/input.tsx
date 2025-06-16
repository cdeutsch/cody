import * as React from 'react'

import { cn } from '../utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'tw-flex tw-h-10 tw-w-full tw-border-input-border tw-text-input-foreground tw-rounded-md tw-border tw-border-input tw-bg-input-background tw-px-3 tw-py-2 file:tw-border-0 file:tw-bg-transparent file:tw-text-sm file:tw-font-medium file:tw-text-foreground placeholder:tw-text-muted-foreground focus-visible:tw-outline-none disabled:tw-cursor-not-allowed disabled:tw-opacity-50 md:tw-text-sm',
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = 'Input'

export { Input }
