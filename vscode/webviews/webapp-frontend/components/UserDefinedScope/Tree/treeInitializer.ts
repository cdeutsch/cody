import type { MutableRefObject } from 'react'

import type { TreeProps } from './DriverTree'
import renderer from './renderer'

export interface DriverTreeNode {
    kind: string
    children?: DriverTreeNode[]
    name: string
    id: string
}

export interface TreeNode {
    id: string
    state: {
        checked: boolean
        indeterminate: boolean
        rootNode?: TreeNode
        depth: number
    }
    children?: TreeNode[]
}

const updateCheckboxState = (tree: any) => {
    const checkboxes = tree.contentElement.querySelectorAll('input[type="checkbox"]')
    for (let i = 0; i < checkboxes.length; ++i) {
        const checkbox = checkboxes[i] as HTMLInputElement
        if (checkbox.hasAttribute('data-indeterminate')) {
            checkbox.indeterminate = true
        } else {
            checkbox.indeterminate = false
        }
    }
}

const getCheckedNodes = (tree: TreeNode | null): string[] => {
    if (!tree) return []
    const checkedNodes: string[] = []
    const recurse = (tree: TreeNode) => {
        if (tree.state.checked && !tree.state.indeterminate) {
            checkedNodes.push(tree.id)
        } else if (tree.children) {
            // biome-ignore lint/complexity/noForEach: <explanation>
            tree.children.forEach(child => recurse(child))
        }
    }
    recurse(tree)
    return checkedNodes
}

export const initializeTree = (
    InfiniteTree: any,
    props: TreeProps,
    ref: MutableRefObject<HTMLDivElement | null>,
    treeRef: MutableRefObject<any>,
    theme: string
) => {
    let tree: any
    try {
        tree = new InfiniteTree({
            el: ref.current,
            data: props.data,
            autoOpen: true,
            rowRenderer: renderer(theme),
        })
    } catch (e) {
        // seeing an error here on the infinite-tree package
        // TypeError: el.className.split is not a function
        // we can safely ignore, the tree will get recreated
    }
    if (!tree) return
    treeRef.current = tree
    // open the first level of the tree
    // biome-ignore lint/complexity/noForEach: <explanation>
    tree.nodes.forEach((node: TreeNode) => {
        tree.openNode(node)
    })
    tree.on('contentDidUpdate', () => {
        updateCheckboxState(tree)
    })
    tree.on('clusterDidChange', () => {
        updateCheckboxState(tree)
    })
    if (props.defaultValues) {
        props.setChecked(props.defaultValues)
        // biome-ignore lint/complexity/noForEach: <explanation>
        tree.nodes.forEach((node: TreeNode) => {
            if (props.defaultValues.includes(node.id)) {
                tree.checkNode(node)
            }
        })
    } else {
        // check the top node
        props.setChecked([tree.nodes[0].id])
        tree.checkNode(tree.nodes[0])
    }
    tree.on('click', (event: MouseEvent) => {
        const currentNode = tree.getNodeFromPoint(event.clientX, event.clientY)
        if (!currentNode) {
            return
        }

        if ((event.target as HTMLElement).className === 'checkbox') {
            event.stopPropagation()
            tree.checkNode(currentNode)
            const rootNode = tree.state.rootNode.children[0]
            const checkedNodes = getCheckedNodes(rootNode)
            props.setChecked(checkedNodes)
            return
        }
    })
    return tree
}
