import type { SerializedElementNode, SerializedLexicalNode, SerializedTextNode } from 'lexical'
import type { SerializedPromptEditorValue } from './editorState'
import type { SerializedContextItem, SerializedContextItemMentionNode } from './nodes'

export const AT_MENTION_SERIALIZED_PREFIX = 'driver://serialized.v1'
const AT_MENTION_SERIALIZATION_END = '_'
const BASE_64_CHARACTERS = '[A-Za-z0-9+/]+={0,2}'

function unicodeSafeBtoa(str: string) {
    return btoa(encodeURIComponent(str))
}

function unicodeSafeAtob(str: string) {
    return decodeURIComponent(atob(str))
}

export const DYNAMIC_MENTION_TO_HYDRATABLE: Record<string, string> = {
    'current-selection': 'driver://selection',
    'current-file': 'driver://current-file',
    'current-repository': 'driver://repository',
    'current-directory': 'driver://current-dir',
    'current-open-tabs': 'driver://tabs',
}

function isDynamicMentionKey(value: string): value is keyof typeof DYNAMIC_MENTION_TO_HYDRATABLE {
    return !!DYNAMIC_MENTION_TO_HYDRATABLE[value]
}

/**
 * This function serializes a SerializedPromptEditorValue into a string representation that contains serialized
 * elements for contextMentionItems as a base64 encoded string or driver:// syntax for current mentions.
 * The result can be used with the deserialize function to rebuild the editor state.
 *
 * @param m SerializedPromptEditorValue
 */
export function serialize(m: SerializedPromptEditorValue): string {
    const nodes: SerializedLexicalNode[] = renderChildNodes(m.editorState.lexicalEditorState.root)
    let t = ''
    for (const n of nodes) {
        if (n.type === 'text' || n.type === 'tab') {
            t += (n as SerializedTextNode).text
        } else if (n.type === 'linebreak') {
            t += '\n'
        } else if (n.type === 'contextItemMention') {
            const contextItemMention: SerializedContextItem = (n as SerializedContextItemMentionNode)
                .contextItem
            if (isDynamicMentionKey(contextItemMention.type)) {
                t += DYNAMIC_MENTION_TO_HYDRATABLE[contextItemMention.type]
            } else {
                t +=
                    `${AT_MENTION_SERIALIZED_PREFIX}?data=${unicodeSafeBtoa(
                        JSON.stringify(n, undefined, 0)
                    )}` + AT_MENTION_SERIALIZATION_END
            }
        }
    }
    return t
}

function renderChildNodes(node: SerializedLexicalNode): SerializedLexicalNode[] {
    switch (node.type) {
        case 'root':
        case 'paragraph': {
            const c = (node as SerializedElementNode).children
            const result: SerializedLexicalNode[] = []
            for (let i = 0; i < c.length; i++) {
                result.push(...renderChildNodes(c[i]))
                // Looking ahead is for adding newlines between paragraphs. We can't append a newline after a
                // paragraph, because that will lead to increasing amounts of newlines at the end of the prompt.
                if (c[i].type === 'paragraph' && c[i + 1]?.type === 'paragraph') {
                    result.push(NEW_LINE_NODE)
                }
            }
            return result
        }
        default:
            return [node]
    }
}

const NEW_LINE_NODE = {
    type: 'text',
    text: '\n',
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    version: 1,
}

function deserializeContextMentionItem(s: string) {
    return JSON.parse(
        unicodeSafeAtob(new URL(s).searchParams.get('data')?.replace(AT_MENTION_SERIALIZATION_END, '')!)
    )
}

const CONTEXT_ITEMS = {
    'driver://selection': {
        description: 'Picks the current selection',
        type: 'current-selection',
        title: 'Current Selection',
        text: 'current selection',
    },
    'driver://current-file': {
        description: 'Picks the current file',
        type: 'current-file',
        title: 'Current File',
        text: 'current file',
    },
    // CD: Driver uses Tuning instead of referencing the current repository.
    // 'driver://repository': {
    //   description: 'Picks the current repository',
    //   type: 'current-repository',
    //   title: 'Current Repository',
    //   text: 'current repository',
    // },
    'driver://current-dir': {
        description: 'Picks the current directory',
        type: 'current-directory',
        title: 'Current Directory',
        text: 'current directory',
    },
    'driver://tabs': {
        description: 'Picks the current open tabs',
        type: 'current-open-tabs',
        title: 'Current Open Tabs',
        text: 'current open tabs',
    },
} as const

export function deserializeParagraph(s: string): SerializedLexicalNode[] {
    const parts = s.split(
        new RegExp(
            `(${AT_MENTION_SERIALIZED_PREFIX}\\?data=${BASE_64_CHARACTERS}${AT_MENTION_SERIALIZATION_END}|${Object.keys(
                CONTEXT_ITEMS
            ).join('|')})`,
            'g'
        )
    )
    return parts
        .flatMap(part => {
            if (part.startsWith(AT_MENTION_SERIALIZED_PREFIX)) {
                try {
                    return deserializeContextMentionItem(part)
                } catch (e) {
                    console.warn(e)
                    return {
                        type: 'text',
                        text: part,
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        version: 1,
                    }
                }
            }
            for (const [uri, item] of Object.entries(CONTEXT_ITEMS)) {
                if (part === uri) {
                    return createContextItemMention(item, uri)
                }
            }

            // We have to recreate tab nodes, or the editor
            // will ignore the \t characters.
            if (part.includes('\t')) {
                return part
                    .split(/(\t)/)
                    .filter(Boolean)
                    .flatMap(subPart =>
                        subPart === '\t'
                            ? {
                                  type: 'tab',
                                  detail: 2,
                                  format: 0,
                                  mode: 'normal',
                                  style: '',
                                  text: '\t',
                                  version: 1,
                              }
                            : {
                                  type: 'text',
                                  text: subPart,
                                  detail: 0,
                                  format: 0,
                                  mode: 'normal',
                                  style: '',
                                  version: 1,
                              }
                    )
            }

            return {
                type: 'text',
                text: part,
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                version: 1,
            }
        })
        .filter(node => node.text !== '')
}

function createContextItemMention(
    item: (typeof CONTEXT_ITEMS)[keyof typeof CONTEXT_ITEMS],
    uri: string
) {
    return {
        contextItem: {
            description: item.description,
            id: item.type,
            name: item.type,
            type: item.type,
            title: item.title,
            uri,
        },
        isFromInitialContext: false,
        text: item.text,
        type: 'contextItemMention',
        version: 1,
    }
}

const AT_MENTION_REGEX = /(driver:\/\/(?:serialized[^_]+_|[a-zA-Z0-9-]+))/

export function splitToWords(s: string): string[] {
    /**
     * Regular expression pattern that matches Driver context mentions in two formats:
     * 1. Built-in shortcuts like 'driver://tabs', 'driver://selection' (defined in CONTEXT_ITEMS)
     * 2. Serialized context items like 'driver://serialized.v1?data=base64data_'
     *
     * For built-in shortcuts: includes letters and numbers, and dash (-). Those are not part of built-in shortcuts.
     * For serialized items: includes everything between 'driver://serialized' and '_'
     *
     * Examples:
     * - "driver://tabs." -> matches "driver://tabs"
     * - "explain driver://current-selection's content" -> matches "driver://current-selection"
     * - "driver://serialized.v1?data=123_." -> matches "driver://serialized.v1?data=123_"
     */
    return s.split(AT_MENTION_REGEX)
}

function deserializeDoc(s: string): SerializedLexicalNode[] {
    const paragraphs = s.split('\n')
    return paragraphs.map(deserializeParagraph).map(children => {
        return {
            type: 'paragraph',
            children,
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            textStyle: '',
            textFormat: 0,
        }
    })
}

/**
 * Deserializes a prompt editor value from a previously serialized editor value.
 *
 * @param s serialized editor value
 */
export function deserialize(s: string): SerializedPromptEditorValue | undefined {
    const children: SerializedLexicalNode[] = deserializeDoc(s)

    return {
        text: 'text',
        // We don't need to provide the contextItems here, they seem to be
        // resolved just fine when running the prompt.
        contextItems: [],
        editorState: {
            v: 'lexical-v1',
            minReaderV: 'lexical-v1',
            lexicalEditorState: {
                root: {
                    type: 'root',
                    children,
                    format: '',
                    indent: 0,
                    version: 1,
                    direction: 'ltr',
                },
            },
        },
    }
}
