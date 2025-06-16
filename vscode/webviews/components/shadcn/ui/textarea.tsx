import * as React from 'react'
import TextareaAutosizeComponent, { type TextareaAutosizeProps } from 'react-textarea-autosize'

import { cn } from '../utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const textareaStyles =
    'tw-flex tw-min-h-[60px] tw-w-full tw-text-input-foreground tw-rounded-md tw-border tw-border-input-border tw-bg-input-background tw-px-3 tw-py-2 tw-text-sm tw-shadow-sm placeholder:tw-text-muted-foreground focus-visible:tw-outline-none focus-visible:tw-ring-1 focus-visible:tw-ring-ring disabled:tw-cursor-not-allowed disabled:tw-opacity-50'

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
    return <textarea className={cn(textareaStyles, className)} ref={ref} {...props} />
})
Textarea.displayName = 'Textarea'

// TextareaAutosize component that uses the same styling as the Textarea component
const TextareaAutosize = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(
    ({ className, ...props }, ref) => {
        return (
            <TextareaAutosizeComponent
                data-slot="textarea"
                className={cn(textareaStyles, className)}
                {...props}
            />
        )
    }
)
TextareaAutosize.displayName = 'TextareaAutosize'

export { Textarea, TextareaAutosize }
