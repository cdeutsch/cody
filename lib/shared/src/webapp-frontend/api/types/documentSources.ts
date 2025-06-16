import type { VersionStatusType } from './node'

export interface DocPrimaryAsset {
    id: string
    organization_id: string
    kind: string
    display_name: string
    created_at: string
    updated_at: string
}

export interface Version {
    id: string
    primary_asset_id: string
    display_name: string
    created_at: string
    updated_at: string
    status: VersionStatusType
    primary_asset: DocPrimaryAsset
}

export interface SourceNode {
    id: string
    version_id: string
    relative_path: string
    kind: string
    created_at: string
    updated_at: string
    version: Version
}

export interface Source {
    source_node: SourceNode
    page_node_id: string
    source_node_id: string
}

export interface AssociatedSourcesResponse {
    results: Source[]
    total_count: number
}
