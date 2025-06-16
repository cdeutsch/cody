import debounce from 'lodash/debounce'
import { Expand, Minimize2, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '../../../../components/shadcn/ui/button'
import { Input } from '../../../../components/shadcn/ui/input'
import { type DriverTreeNode, type TreeNode, initializeTree } from './treeInitializer'

import './driver-check-tree.css'

const filterOptions = {
    caseSensitive: false,
    exactMatch: false,
    includeAncestors: true,
    includeDescendants: true,
}

export interface TreeProps {
    data: DriverTreeNode
    defaultValues: string[]
    setChecked: (checkedNodes: string[]) => void
}

export const DriverTree: React.FC<TreeProps> = props => {
    const ref = useRef<HTMLDivElement | null>(null)
    const treeRef = useRef<any>(null)
    const [isToggledAllNodes, setIsToggledAllNodes] = useState(false)
    const [matchCount, setMatchCount] = useState(0)

    useEffect(() => {
        // FUTURE: CD, now that we're off NextJs and don't have SSR, we can probably stop loading infinite-tree dynamically.
        const loadTree = async () => {
            // @ts-ignore
            return (await import('infinite-tree')).default
        }
        loadTree().then(InfiniteTree => {
            // Give the UI time to render before initializing the tree.
            // This is so we can get an accurate height for the .infinite-tree-node elements.
            setTimeout(() => {
                if (treeRef.current) return
                const tree = initializeTree(InfiniteTree, props, ref, treeRef, 'light')
                // close all nodes except the root, this can be done with autoOpen: false
                // but if we don't use autoOpen, children that are not shown will not reflect
                // their checked state when they are expanded
                // biome-ignore lint/complexity/noForEach: <explanation>
                tree.nodes.forEach((node: TreeNode) => {
                    if (node.state.depth > 0) {
                        tree.closeNode(node)
                    }
                })
            }, 150)
        })
    }, [props])

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchValue = e.target.value ?? ''
        treeRef.current.filter(searchValue, filterOptions)

        // Remove previous highlights
        const highlightedElements = document.querySelectorAll('.highlight')
        // biome-ignore lint/complexity/noForEach: <explanation>
        highlightedElements.forEach(el => {
            el.classList.remove('highlight')
        })

        // Highlight matching text
        if (searchValue) {
            setIsToggledAllNodes(true)
            toggleAllNodes(true)
            const titles = document.querySelectorAll('.infinite-tree-title')
            // biome-ignore lint/complexity/noForEach: <explanation>
            titles.forEach(node => {
                const text = node.textContent || ''
                const regex = new RegExp(`(${searchValue})`, 'gi')
                const matchCount = (text.match(regex) || []).length
                setMatchCount(prev => prev + matchCount)
                const newText = '<span class="highlight">$1</span>'
                node.innerHTML = text.replace(regex, newText)
            })
        } else {
            setMatchCount(0)
        }
    }

    const toggleAllNodes = (shouldOpen: boolean) => {
        setIsToggledAllNodes(shouldOpen)

        const toggleNodesIteratively = (rootNode: any) => {
            const stack = [rootNode]
            const visited = new Set()

            while (stack.length > 0) {
                const node = stack.pop()

                if (visited.has(node.id)) {
                    continue
                }
                visited.add(node.id)

                if (node.children) {
                    stack.push(...node.children)
                }

                if (shouldOpen) {
                    if (!node.state.open) {
                        treeRef.current.openNode(node)
                    }
                } else {
                    if (node.state.depth === 0) {
                        treeRef.current.openNode(node)
                    } else if (node.state.open) {
                        treeRef.current.closeNode(node)
                    }
                }
            }
        }

        if (treeRef.current) {
            toggleNodesIteratively(treeRef.current.nodes[0])
        }
    }

    const debouncedHandleSearch = debounce(handleSearch, 300)

    return (
        <>
            <div className="tw-relative tw-mb-4 tw-w-full">
                <SearchIcon className="tw-absolute tw-left-3 tw-top-1/2 tw-h-6 tw-w-6 tw-transform -tw-translate-y-1/2" />
                <Input
                    type="text"
                    placeholder="Go to folder or file"
                    onChange={debouncedHandleSearch}
                    className="tw-pl-10"
                />
                {matchCount > 0 && (
                    <span className="tw-absolute tw-right-2 tw-top-1/2 tw-transform -tw-translate-y-1/2">
                        {matchCount === 1 ? `${matchCount} match` : `${matchCount} matches`}
                    </span>
                )}
            </div>
            <div className="tw-absolute tw-right-0 tw-top-[24px] tw-flex tw-space-x-2 tw-opacity-60">
                {isToggledAllNodes && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAllNodes(false)}
                        className="mb-2 p-2"
                    >
                        <Minimize2 />
                    </Button>
                )}
                {!isToggledAllNodes && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAllNodes(true)}
                        className="mb-2 p-2"
                    >
                        <Expand />
                    </Button>
                )}
            </div>
            <div className="tw-text-muted-foreground tw-mb-2 tw-text-xs tw-font-medium">Files</div>
            {/* Set the height of the tree in driver-check-tree.css */}
            <div className="driver-check-tree" ref={ref} />
        </>
    )
}
