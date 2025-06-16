import type { DriverTreeNode } from './treeInitializer'

export interface FlatNode {
    __typename: string
    id: string
    name: string
    path: string
    kind: string
    children: string[]
}

export function buildTreeData(nodes: FlatNode[], codebaseId: string): DriverTreeNode | null {
    if (!nodes || nodes.length === 0) return null
    if (!codebaseId) return null

    // Create a sorted copy of the nodes array
    const nodeList = [...nodes].sort((a, b) => {
        // Sort directories first
        if (a.kind === 'directory' && b.kind !== 'directory') return -1
        if (a.kind !== 'directory' && b.kind === 'directory') return 1
        // Then sort alphabetically by path
        return a.path.localeCompare(b.path)
    })
    let root: DriverTreeNode | null = null
    const pathToNode: { [key: string]: DriverTreeNode } = {}

    // biome-ignore lint/complexity/noForEach: <explanation>
    nodeList.forEach(node => {
        const pathParts = node.path.replace(/\/$/, '').split('/')
        const parentPath = pathParts.slice(0, -1).join('/')
        const currentNode: DriverTreeNode = {
            id: node.id,
            name: node.name,
            kind: node.kind,
        }

        if (!parentPath) {
            root = currentNode
            root.id = codebaseId
        } else {
            const parentNode = pathToNode[parentPath]
            if (parentNode) {
                if (parentNode.children) {
                    parentNode.children.push(currentNode)
                } else {
                    parentNode.children = [currentNode]
                }
            }
        }

        // Map this node's path to the node itself
        pathToNode[node.path.replace(/\/$/, '')] = currentNode
    })
    return root
}
