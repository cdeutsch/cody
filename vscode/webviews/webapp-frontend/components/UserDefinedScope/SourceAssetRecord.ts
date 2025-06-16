import uniq from 'lodash/uniq'

import type {
    AssociatedSourcesResponse,
    PrimaryAssetRecord,
    VersionDetail,
    VersionStatusType,
} from '@sourcegraph/cody-shared'
import { PrimaryAsset } from '@sourcegraph/cody-shared'

import type { SourceContentType } from './SourceContentType'

export interface SourceAssetRecord {
    id: string
    node_id: string
    primary_asset_id: string
    display_name: string
    kind: SourceContentType
    created_at: string
    updated_at: string
    most_recent_version?: VersionDetail
    children?: string[]
    status: VersionStatusType
    versionName?: string
    versionId?: string
}

export const getSourceAssetIds = (sourceAssetRecords: SourceAssetRecord[]): string[] => {
    const sourceIds = flattenSourceAssets(sourceAssetRecords)

    const uniqueSourceIds = uniq(sourceIds)

    return uniqueSourceIds
}

export const flattenSourceAssets = (selectedAssets: SourceAssetRecord[]): string[] => {
    return selectedAssets.flatMap(asset => {
        if (asset.children && asset.children.length > 0) {
            return asset.children
        }
        return [asset.node_id]
    })
}

export const transformSourcesData = (
    data: AssociatedSourcesResponse | undefined
): SourceAssetRecord[] => {
    if (!data) return []
    const primaryAssetMap = new Map()

    // biome-ignore lint/complexity/noForEach: <explanation>
    data.results.forEach(result => {
        const { source_node } = result
        const { version } = source_node
        const primaryAsset = version.primary_asset
        const compositeAssetId = `${primaryAsset.id}-${version.id}`

        if (!primaryAssetMap.has(compositeAssetId)) {
            const sourceAsset: SourceAssetRecord = {
                id: compositeAssetId,
                node_id: source_node.id,
                status: version.status as VersionStatusType,
                versionId: version.id,
                versionName: version.display_name,
                primary_asset_id: primaryAsset.id,
                display_name: primaryAsset.display_name,
                kind: primaryAsset.kind as SourceContentType,
                created_at: source_node.created_at,
                updated_at: source_node.updated_at,
                children: [],
            }
            primaryAssetMap.set(compositeAssetId, sourceAsset)
        }
    })

    // biome-ignore lint/complexity/noForEach: <explanation>
    data.results.forEach(result => {
        const { source_node } = result
        const { version } = source_node
        const primaryAsset = version.primary_asset
        const compositeAssetId = `${primaryAsset.id}-${version.id}`

        const isCodebaseDirectory = source_node.kind === PrimaryAsset.CODEBASE_DIRECTORY
        const isRootDir = isCodebaseDirectory && source_node.relative_path?.split('/').length === 2
        // don't add a node as a child if it is the root directory
        if (!isRootDir) {
            primaryAssetMap.get(compositeAssetId).children.push(source_node.id)
        }
    })
    return Array.from(primaryAssetMap.values())
}

export const mapToSourceAssetRecord = (item: PrimaryAssetRecord): SourceAssetRecord => {
    return {
        id: item.id + '-' + item.most_recent_version?.id,
        node_id: item.most_recent_version?.root_node?.id ?? '',
        primary_asset_id: item.id,
        display_name: item.display_name,
        kind: item.kind as SourceContentType,
        created_at: item.created_at,
        updated_at: item.updated_at,
        most_recent_version: item.most_recent_version,
        status: item.most_recent_version?.status as VersionStatusType,
        versionId: item.most_recent_version?.id,
        versionName: item.most_recent_version?.display_name,
    }
}
