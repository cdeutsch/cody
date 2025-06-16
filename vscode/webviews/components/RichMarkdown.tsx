// cspell:ignore mdast
import { clsx } from 'clsx'
import type { Code, CodeData, Root } from 'mdast'
import type React from 'react'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

import { MarkdownFromCody } from './MarkdownFromCody'
import { RichCodeBlock } from './RichCodeBlock'

interface RichMarkdownProps {
    markdown: string
    isMessageLoading: boolean
    onCopy?: (code: string) => void
    onInsert?: (code: string, newFile?: boolean) => void
    onExecute?: (command: string) => void
    className?: string
}

interface TerminatedCodeData extends CodeData {
    hProperties?: {
        // Whether the code block has been output completely. The processor is
        // always fed markdown with terminators (```) so we instead check to see
        // if the terminator is at the end of the file. Hence, this will be true
        // when the block is definitely complete, but it may return false for
        // blocks at the end of the generated output. You must combine this flag
        // with an indicator for whether the whole response is complete.
        'data-is-code-complete': boolean
        // The markdown source of the block, including the ``` fences, language
        // and filename specifier, etc.
        'data-source-text': string
        // This is provided by the remarkAttachFilePathToCodeBlocks plugin, but
        // we mention it here for convenience reading it later.
        'data-file-path': string
        // This is provided by the remarkAttachFilePathToCodeBlocks plugin, but
        // we mention it here for convenience reading it later.
        'data-language': string
    }
}

export const remarkAttachCompletedCodeBlocks: Plugin<[], Root> = () => {
    return (tree: Root, file) => {
        visit(tree, 'code', (node: Code) => {
            const sourceText = file.value
                .slice(node.position?.start.offset, node.position?.end.offset)
                .toString()
            const isComplete = (node.position?.end.offset ?? 0) < file.value.length
            node.data = {
                ...node.data,
                hProperties: {
                    ...(node.data as TerminatedCodeData)?.hProperties,
                    'data-is-code-complete': isComplete,
                    'data-source-text': sourceText,
                },
            } as TerminatedCodeData
        })
    }
}

/**
 * RichMarkdown renders markdown content with enhanced code blocks.
 * It customizes the markdown renderer to use RichCodeBlock for code blocks,
 * which provides syntax highlighting, action buttons, and optional guardrails
 * protection.
 */
export const RichMarkdown: React.FC<RichMarkdownProps> = ({ markdown, className }) => {
    // Handle rendering of code blocks with our custom RichCodeBlock component
    const components = {
        pre({ node, inline, className, children, ...props }: any) {
            // Don't process inline code blocks
            if (inline) {
                return (
                    <code className={className} {...props}>
                        {children}
                    </code>
                )
            }

            // Render with our RichCodeBlock component
            return <RichCodeBlock>{children}</RichCodeBlock>
        },
    }

    return (
        <div className={clsx('markdown-content', className)}>
            <MarkdownFromCody
                components={components}
                prefixRemarkPlugins={[remarkAttachCompletedCodeBlocks]}
            >
                {markdown}
            </MarkdownFromCody>
        </div>
    )
}
