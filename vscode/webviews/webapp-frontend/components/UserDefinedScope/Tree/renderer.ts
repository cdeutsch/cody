import clsx from 'clsx'
import escapeHTML from 'escape-html'
// @ts-ignore
import tag from 'html5-tag'

const folder = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`
const file = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`
const chevronDown = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`
const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>`

interface NodeState {
    depth: number
    open: boolean
    path: string
    total: number
    selected?: boolean
    filtered?: boolean
    checked?: boolean
    indeterminate?: boolean
}

interface NodeProps {
    [key: string]: any
}

interface Node {
    id: string
    name: string
    kind: string
    loadOnDemand?: boolean
    children: { [key: string]: Node }
    state: NodeState
    props?: NodeProps
    hasChildren: () => boolean
}

interface TreeOptions {
    togglerClass: string
}

const createRenderer =
    (theme: string) =>
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
    (node: Node, treeOptions: TreeOptions): string | void => {
        const { id, name, children, state } = node
        const { depth, open, path, total, selected = false, filtered, checked, indeterminate } = state
        const childrenLength = Object.keys(children).length
        const more = node.hasChildren()

        if (filtered === false) {
            return
        }

        if (window.matchMedia && theme === 'system') {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                theme = 'dark'
            } else {
                theme = 'light'
            }
        }

        let togglerIcon = '-'
        if (more && open) {
            togglerIcon = chevronDown
        } else if (more && !open) {
            togglerIcon = chevronRight
        }

        const toggler = tag(
            'span',
            {
                class: (() => {
                    if (!more) {
                        return clsx(treeOptions.togglerClass, 'empty')
                    }
                    if (more && open) {
                        return clsx(treeOptions.togglerClass, 'chevron-down', theme)
                    }
                    if (more && !open) {
                        return clsx(
                            treeOptions.togglerClass,
                            'infinite-tree-closed',
                            'chevron-right',
                            theme
                        )
                    }
                    return ''
                })(),
            },
            togglerIcon
        )

        const checkbox = tag('input', {
            type: 'checkbox',
            style: 'display: inline-block; margin: 0 3px',
            class: 'checkbox',
            checked: checked,
            'data-checked': checked,
            'data-indeterminate': indeterminate,
        })

        const title = tag(
            'span',
            {
                class: clsx('infinite-tree-title', 'text-sm', 'font-medium'),
            },
            escapeHTML(name)
        )

        const type = node.kind === 'file' ? file : folder

        const icon = tag(
            'span',
            {
                class: clsx('infinite-tree-icon'),
            },
            type
        )

        const marginLeft = depth * 18 + (more ? 0 : 3)
        const treeNode = tag(
            'div',
            {
                class: 'infinite-tree-node',
                style: `margin-left: ${marginLeft}px`,
            },
            toggler + checkbox + icon + title
        )

        return tag(
            'div',
            {
                'data-id': id,
                'data-expanded': more && open,
                'data-depth': depth,
                'data-path': path,
                'data-selected': selected,
                'data-children': childrenLength,
                'data-total': total,
                class: clsx(
                    'infinite-tree-item',
                    'relative',
                    { 'infinite-tree-selected': selected },
                    `infinite-tree-${type}`
                ),
            },
            treeNode
        )
    }

export default createRenderer
