import type { CodebaseReportStats } from './codebase'

export interface FullNodeRecord {
    primary_asset_updated_at: string
    primary_asset_display_name: string
    primary_asset_id: string
    primary_asset_organization_id: string
    version_id: string
    version_updated_at: string
    node_relative_path: string
    node_updated_at: string
    primary_asset_created_at: string
    primary_asset_primary_asset_type: string
    version_display_name: string
    version_created_at: string
    node_id: string
    node_created_at: string
}

export interface VersionCreator {
    id: string
    full_name: string
    email: string
}

export interface VersionNodeBase {
    id: string
    version_id: string
    relative_path: string
    kind: string
    created_at: string
    updated_at: string
    depth: number
}

export interface VersionBase {
    id: string
    primary_asset_id: string
    display_name: string
    created_at: string
    updated_at: string
    status: VersionStatusType
    root_node?: VersionNodeBase
}

export interface VersionDetail extends VersionBase {
    root_node: VersionNodeBase & {
        misc_metadata: CodebaseReportStats
    }
    browsable?: boolean
    creator?: VersionCreator
}

export interface PrimaryAssetBasic {
    id: string
    organization_id: string
    kind: PrimaryAssetType
    display_name: string
    created_at: string
    updated_at: string
}

export interface PrimaryAssetRecord extends PrimaryAssetBasic {
    content?: string
    browsable?: boolean
    tags?: any[]
    most_recent_version?: VersionDetail
}

export const PrimaryAsset = {
    FILE: 'FILE',
    CODEBASE: 'CODEBASE',
    CODEBASE_DIRECTORY: 'CODEBASE_DIRECTORY',
    PAGE: 'PAGE',
    PAGE_TEMPLATE: 'PAGE_TEMPLATE',
    DRIVER_TEMPLATE: 'DRIVER_TEMPLATE',
} as const

export type PrimaryAssetType = (typeof PrimaryAsset)[keyof typeof PrimaryAsset]

export const ColumnFiltersAssetType = ['FILE', 'CODEBASE', 'PAGE'] as const

export type ColumnFiltersAssetType = (typeof ColumnFiltersAssetType)[number]

export interface PrimaryAssetResponse {
    results: PrimaryAssetRecord[]
    total_count: number
}

export interface VersionNodeRecord extends Omit<NodeRecord, 'version'> {}

export interface VersionRecord extends VersionBase {
    id: string
    primary_asset_id: string
    display_name: string
    created_at: string
    updated_at: string
    status: VersionStatusType
    browsable: boolean
    primary_asset: PrimaryAssetBasic
    root_node?: VersionNodeBase
    creator?: VersionCreator
}

export interface VersionResponse {
    results: VersionRecord[]
    total_count: number
}

export interface NodeRecord {
    id: string
    version_id: string
    relative_path: string
    kind: string
    created_at: string
    updated_at: string
    depth: number
    version: VersionRecord
}

export const VersionStatus = {
    GENERATION_COMPLETE: 'GENERATION_COMPLETE',
    GENERATING: 'GENERATING',
    GENERATION_ERROR: 'GENERATION_ERROR',
    CONNECTED: 'CONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
} as const

export type VersionStatusType = (typeof VersionStatus)[keyof typeof VersionStatus]

export const VersionStatusDisplayName: Record<VersionStatusType, string> = {
    [VersionStatus.GENERATION_COMPLETE]: 'Generation Complete',
    [VersionStatus.GENERATING]: 'Generating',
    [VersionStatus.GENERATION_ERROR]: 'Generation Error',
    [VersionStatus.CONNECTED]: 'Connected',
    [VersionStatus.CONNECTING]: 'Connecting',
    [VersionStatus.CONNECTION_FAILED]: 'Connection Failed',
}

export const BrowsableVersionStatuses: VersionStatusType[] = [
    VersionStatus.GENERATION_COMPLETE,
    VersionStatus.GENERATING,
    VersionStatus.GENERATION_ERROR,
] as const

export const SelectableVersionStatuses: VersionStatusType[] = [
    VersionStatus.GENERATION_COMPLETE,
    VersionStatus.GENERATING,
    VersionStatus.CONNECTED,
] as const

export interface ContentRecord {
    misc_metadata: Record<string, any>
    id: string
    content: string | null
    content_kind: string
    version_id: string | null
    node_id: string
    content_type_id: string
    source_content_id: string
    content_name: string | null
    tags: any[]
    created_at: string
    updated_at: string
    node: {
        id: string
        version_id: string
        created_at: string
        misc_metadata: any | null
        kind: string
        relative_path: string
        updated_at: string
        version: {
            id: string
            primary_asset_id: string
            display_name: string
            created_at: string
            updated_at: string
            status: VersionStatusType
            browsable: boolean
            primary_asset: PrimaryAssetBasic
            creator?: VersionCreator
            previous_version_id?: string | null
        }
    }
}

export interface ContentResponse {
    results: ContentRecord[]
    total_count: number
}

export interface FetchPrimaryAssetParams {
    id?: string
    id__in?: string
    display_name__ilike?: string
    display_name__in?: string
    limit: number
    offset: number
    kind?: PrimaryAssetType[]
    sort_by?: string
    sort_direction?: 'ASC' | 'DESC'
    tag_ids?: string[]
    'versions.status'?: VersionStatusType | VersionStatusType[]
    'versions.root_node.misc_metadata.top_language__in'?: string[]
    created_at__gte?: string
    created_at__lte?: string
    updated_at__gte?: string
    updated_at__lte?: string
}

export interface FetchVersionParams {
    limit?: number
    offset?: number
    sort_by?: string
    sort_direction?: 'ASC' | 'DESC'
    id?: string
    primary_asset_id?: string
    status?: VersionStatusType | VersionStatusType[]
}

export interface FetchContentParams {
    node_id?: string
}

export interface CreateDocumentResponse {
    id: string
    node_id: string
    content: string
    content_kind: string
    misc_metadata: Record<string, any>
    created_at: string
    updated_at: string
    node: {
        id: string
        version_id: string
        relative_path: string
        kind: string
        created_at: string
        updated_at: string
        version: {
            id: string
            primary_asset_id: string
            display_name: string
            created_at: string
            updated_at: string
            status: VersionStatusType
            primary_asset: PrimaryAssetBasic
        }
    }
}
