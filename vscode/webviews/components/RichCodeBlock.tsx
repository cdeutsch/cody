import { clsx } from 'clsx'
import type React from 'react'

import styles from '../chat/ChatMessageContent/ChatMessageContent.module.css'

interface RichCodeBlockProps {
    className?: string
    children?: React.ReactNode
}

/**
 * RichCodeBlock is a component that displays code with syntax highlighting,
 * a toolbar to copy/insert/apply/execute the code, and guardrails checks.
 *
 * Note: This component waits for isCodeComplete to be true before
 * triggering any guardrails or smart apply caching, which prevents making
 * excessive API calls during incremental code block generation.
 */
export const RichCodeBlock: React.FC<RichCodeBlockProps> = ({ className, children }) => {
    return (
        <div className={clsx('tw-overflow-hidden', className)}>
            <pre className={styles.content}>{children}</pre>
        </div>
    )
}
