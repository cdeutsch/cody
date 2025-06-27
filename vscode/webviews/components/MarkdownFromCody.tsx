import { DriverIDE } from '@sourcegraph/cody-shared'
import type { Root } from 'hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Components } from 'hast-util-to-jsx-runtime'
import { urlAttributes } from 'html-url-attributes'
import type { FunctionComponent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import rehypeHighlight from 'rehype-highlight'
import rehypeMermaid from 'rehype-mermaid'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGFM from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { Pluggable } from 'unified'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'

import { remarkAttachFilePathToCodeBlocks } from '../chat/extract-file-path'
import { SYNTAX_HIGHLIGHTING_LANGUAGES } from '../utils/highlight'
import { useConfig } from '../utils/useConfig'

type UrlTransform = (url: string) => string | null | undefined

// Safe protocol regex from react-markdown
const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i

/**
 * Make a URL safe.
 * This follows how GitHub works.
 * Copied from react-markdown.
 */
function defaultUrlTransform(value: string): string {
    const colon = value.indexOf(':')
    const questionMark = value.indexOf('?')
    const numberSign = value.indexOf('#')
    const slash = value.indexOf('/')

    if (
        // If there is no protocol, it's relative.
        colon === -1 ||
        // If the first colon is after a `?`, `#`, or `/`, it's not a protocol.
        (slash !== -1 && colon > slash) ||
        (questionMark !== -1 && colon > questionMark) ||
        (numberSign !== -1 && colon > numberSign) ||
        // It is a protocol, it should be allowed.
        safeProtocol.test(value.slice(0, colon))
    ) {
        return value
    }

    return ''
}

/**
 * Supported URIs to render as links in outputted markdown.
 * - https?: Web
 * - file: local file scheme
 * - vscode: VS Code URL scheme (open in editor)
 * - command:driver. VS Code command scheme for driver (run command)
 * {@link DRIVER_PASSTHROUGH_VSCODE_OPEN_COMMAND_ID}
 */
const ALLOWED_URI_REGEXP = /^((https?|file|vscode):\/\/[^\s#$./?].\S*$|(command:_?driver.*))/i

const ALLOWED_ELEMENTS = [
    'p',
    'div',
    'span',
    'pre',
    'i',
    'em',
    'b',
    'strong',
    'code',
    'pre',
    'kbd',
    'blockquote',
    'ul',
    'li',
    'ol',
    'a',
    'table',
    'tr',
    'th',
    'td',
    'thead',
    'tbody',
    'tfoot',
    's',
    'u',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'br',
    'think',
    // Add SVG elements for Mermaid
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'text',
    'line',
    'polygon',
    'polyline',
    'ellipse',
    'defs',
    'marker',
    'foreignObject',
]

function defaultUrlProcessor(url: string): string {
    const processedURL = defaultUrlTransform(url)

    if (!ALLOWED_URI_REGEXP.test(processedURL)) {
        return ''
    }

    return processedURL
}

/**
 * Transform URLs to opens links in assistant responses using the `_driver.vscode.open` command.
 */
function wrapLinksWithDriverOpenCommand(url: string): string {
    url = defaultUrlTransform(url)
    if (!ALLOWED_URI_REGEXP.test(url)) {
        return ''
    }
    const encodedURL = encodeURIComponent(JSON.stringify(url))
    return `command:_driver.vscode.open?${encodedURL}`
}

const URL_PROCESSORS: Partial<Record<DriverIDE, UrlTransform>> = {
    [DriverIDE.VSCode]: wrapLinksWithDriverOpenCommand,
}

/**
 * Transforms the children string by wrapping it in one extra backtick if we find '```markdown'.
 * This is used to preserve the formatting of Markdown code blocks within the Markdown content.
 * Such cases happen when you ask Driver to create a Markdown file or when you load a history chat
 * that contains replies for creating Markdown files.
 *
 * @param children - The string to transform.
 * @returns The transformed string.
 */
const childrenTransform = (children: string): string => {
    if (children.indexOf('```markdown') === -1) {
        return children
    }
    children = children.replace('```markdown', '````markdown')
    const lastIdx = children.lastIndexOf('```')

    // Replace the last three backticks with four backticks
    return children.slice(0, lastIdx) + '````' + children.slice(lastIdx + 3)
}

export const MarkdownFromCody: FunctionComponent<{
    className?: string
    prefixRemarkPlugins?: Pluggable[]
    components?: Partial<Components>
    children: string
}> = ({ className, prefixRemarkPlugins = [], components, children }) => {
    const clientType = useConfig().clientCapabilities.agentIDE
    const urlTransform = useMemo(() => URL_PROCESSORS[clientType] ?? defaultUrlProcessor, [clientType])
    const chatReplyTransformed = childrenTransform(children)

    // Create processor with memoization like react-markdown does
    const processor = useMemo(() => {
        const remarkPlugins = [...prefixRemarkPlugins, remarkGFM, remarkAttachFilePathToCodeBlocks]
        const rehypePlugins: Pluggable[] = [
            [
                rehypeSanitize,
                {
                    ...defaultSchema,
                    tagNames: ALLOWED_ELEMENTS,
                    attributes: {
                        ...defaultSchema.attributes,
                        '*': ['className', 'style', 'id'],
                        code: [
                            ...(defaultSchema.attributes?.code || []),
                            ['data-file-path'],
                            ['data-is-code-complete'],
                            ['data-language'],
                            ['data-source-text'],
                            [
                                'className',
                                ...Object.keys(SYNTAX_HIGHLIGHTING_LANGUAGES).map(
                                    language => `language-${language}`
                                ),
                            ],
                        ],
                        svg: ['width', 'height', 'viewBox', 'xmlns'],
                        g: ['transform', 'className'],
                        path: ['d', 'fill', 'stroke', 'strokeWidth', 'className'],
                        rect: [
                            'x',
                            'y',
                            'width',
                            'height',
                            'fill',
                            'stroke',
                            'strokeWidth',
                            'rx',
                            'ry',
                            'className',
                        ],
                        circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'strokeWidth', 'className'],
                        text: [
                            'x',
                            'y',
                            'textAnchor',
                            'dominantBaseline',
                            'fontSize',
                            'fontFamily',
                            'fill',
                            'className',
                        ],
                        line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth', 'className'],
                        polygon: ['points', 'fill', 'stroke', 'strokeWidth', 'className'],
                        polyline: ['points', 'fill', 'stroke', 'strokeWidth', 'className'],
                        ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'strokeWidth', 'className'],
                        defs: [],
                        marker: [
                            'id',
                            'markerWidth',
                            'markerHeight',
                            'refX',
                            'refY',
                            'orient',
                            'markerUnits',
                        ],
                        foreignObject: ['x', 'y', 'width', 'height'],
                    },
                },
            ],
            [
                rehypeHighlight as any,
                {
                    detect: true,
                    languages: SYNTAX_HIGHLIGHTING_LANGUAGES,

                    // `ignoreMissing: true` is required to avoid errors when trying to highlight
                    // partial code blocks received from the LLM that have (e.g.) "```p" for
                    // "```python". This is only needed on rehype-highlight@^6.0.0, which we needed
                    // to downgrade to in order to avoid a memory leak
                    // (https://github.com/remarkjs/react-markdown/issues/791).
                    ignoreMissing: true,
                },
            ],
            [rehypeMermaid],
        ]

        return unified()
            .use(remarkParse)
            .use(remarkPlugins)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypePlugins)
    }, [prefixRemarkPlugins])

    const [error, setError] = useState<Error | undefined>(undefined)
    const [tree, setTree] = useState<Root | undefined>(undefined)
    const [displayError, setDisplayError] = useState<Error | undefined>(undefined)
    const errorTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

    useEffect(() => {
        let cancelled = false
        const file = new VFile()
        file.value = chatReplyTransformed

        processor.run(processor.parse(file), file, (error, tree) => {
            if (!cancelled) {
                setError(error)
                setTree(tree as Root)
            }
        })

        return () => {
            cancelled = true
        }
    }, [chatReplyTransformed, processor])

    // Handle delayed error display
    useEffect(() => {
        // Clear any existing timeout
        if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current)
            errorTimeoutRef.current = undefined
        }

        if (error) {
            // Set a timeout to display the error after 750ms
            errorTimeoutRef.current = setTimeout(() => {
                setDisplayError(error)
            }, 750)
        } else {
            // Clear the display error if there's no error
            setDisplayError(undefined)
        }

        // Cleanup timeout on unmount
        return () => {
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current)
                errorTimeoutRef.current = undefined
            }
        }
    }, [error])

    // If we have a tree (successful render), clear any pending error display
    useEffect(() => {
        if (tree && !error) {
            setDisplayError(undefined)
            if (errorTimeoutRef.current) {
                clearTimeout(errorTimeoutRef.current)
                errorTimeoutRef.current = undefined
            }
        }
    }, [tree, error])

    // Display error if it exists
    if (displayError) {
        return (
            <div className={className}>
                <div
                    style={{
                        color: 'red',
                        padding: '8px',
                        border: '1px solid red',
                        borderRadius: '4px',
                    }}
                >
                    <strong>Error rendering markdown:</strong> {displayError.message}
                </div>
            </div>
        )
    }

    if (!tree) return null

    // Post-process the tree like react-markdown does
    visit(tree, (node, index, parent) => {
        if (node.type === 'element') {
            // Handle URL transformations
            for (const key in urlAttributes) {
                if (
                    node.properties &&
                    Object.hasOwn(urlAttributes, key) &&
                    Object.hasOwn(node.properties, key)
                ) {
                    const value = node.properties[key]
                    const test = urlAttributes[key as keyof typeof urlAttributes]
                    if (test === null || (Array.isArray(test) && test.includes(node.tagName))) {
                        node.properties[key] = urlTransform(String(value || ''))
                    }
                }
            }
        }
    })

    return (
        <div className={className}>
            {toJsxRuntime(tree as any, {
                Fragment,
                components,
                ignoreInvalidStyle: true,
                jsx,
                jsxs,
                passKeys: true,
                passNode: true,
            })}
        </div>
    )
}
