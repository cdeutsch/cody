export type CodebaseVersion = {
    id: string
    version: string
    display_name: string | null
    created_at: string
}

export type CodebaseVersionsResponse = {
    versions: CodebaseVersion[]
    total_count?: number
    limit: number
    offset: number
}

export type CodebaseVersionRequest = {
    codebaseId: string
    limit?: number
    offset?: number
}

export interface AssetUploadResponse {
    upload_url: string
    primary_asset_id: string
    version_id: string
}

export interface CodebaseReportStats {
    analyzable_bytes: number
    analyzable_sloc: number
    total_bytes: number
    total_sloc: number
    analyzable_files: number
    total_files: number
    analyzable_files_by_extension: Record<string, number>
    analyzable_files_by_type: Record<string, number>
    analyzable_bytes_by_extension: Record<string, number>
    analyzable_sloc_by_extension: Record<string, number>
    analyzable_bytes_by_type: Record<string, number>
    analyzable_sloc_by_type: Record<string, number>
}

export const CodebaseReportStatus = {
    Pending: 'pending',
    Running: 'running',
    Completed: 'completed',
    Error: 'error',
    Expired: 'expired',
} as const

export type CodebaseReportStatusType = (typeof CodebaseReportStatus)[keyof typeof CodebaseReportStatus]
