import { getGlobalApi } from './api-axios'
import type { DocumentSet, GetTechDocContentParams, GetTreeParams, Tree } from './api-types'
import type {
    FetchPrimaryAssetParams,
    PrimaryAssetRecord,
    PrimaryAssetResponse,
} from './webapp-frontend/api/types/node'

export const getPrimaryAsset = async (params: FetchPrimaryAssetParams) => {
    const response = await getGlobalApi().get<PrimaryAssetResponse>('/tmp/primary_assets', { params })
    return response.data
}

export async function getPrimaryAssetByRepoName(
    repoName?: string
): Promise<PrimaryAssetRecord | undefined> {
    // Get most recent version.
    const { data: primaryAssetData } = await getGlobalApi().get<PrimaryAssetResponse>(
        '/tmp/primary_assets',
        {
            params: {
                display_name: repoName || '',
                limit: 1,
                kind: 'CODEBASE',
            },
        }
    )

    return primaryAssetData?.results?.[0]
}

export async function getTechDocContent(
    params: GetTechDocContentParams
): Promise<DocumentSet | undefined> {
    const { data: documentSet } = await getGlobalApi().get<DocumentSet>('/tmp/document_set', {
        params,
    })

    return documentSet
}

export async function getTree(params: GetTreeParams): Promise<Tree | undefined> {
    const { data: tree } = await getGlobalApi().get<Tree>('/tmp/tree', {
        params,
    })

    return tree
}
