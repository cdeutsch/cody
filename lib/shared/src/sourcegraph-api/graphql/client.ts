import { getGlobalApi } from '../../api-axios'
import {
    type FetchPrimaryAssetParams,
    PrimaryAsset,
    type PrimaryAssetResponse,
} from '../../webapp-frontend/api/types/node'
import type {
    ContextSearchResult,
    FuzzyFindFile,
    FuzzyFindSymbol,
    Prompt,
    RemoteRepo,
    RepoListResponse,
    SuggestionsRepo,
} from './client-types'
import type { PromptsOrderBy } from './queries'

export async function contextSearch({
    repoIDs,
    query,
    signal,
    filePatterns,
}: {
    repoIDs: string[]
    query: string
    signal?: AbortSignal
    filePatterns?: string[]
}): Promise<ContextSearchResult[] | null | Error> {
    // Return mock data
    return []
}

export async function getFileContent(
    repository: string,
    filePath: string,
    range?: { startLine?: number; endLine?: number },
    signal?: AbortSignal
): Promise<string> {
    // Return mock data
    return 'test'
}

export async function getPdfContextFiles({
    query,
    maxResults,
}: {
    query: string
    maxResults?: number
}): Promise<PrimaryAssetResponse> {
    const params: FetchPrimaryAssetParams = {
        display_name__ilike: `%${query}%`,
        limit: maxResults ?? 10,
        offset: 0,
        kind: [PrimaryAsset.FILE],
        sort_by: query ? 'display_name' : 'created_at',
        sort_direction: query ? 'ASC' : 'DESC',
    }
    const response = await getGlobalApi().get<PrimaryAssetResponse>('/tmp/primary_assets', { params })

    return response.data
}

export async function getRemoteFiles(repositories: string[], query: string): Promise<FuzzyFindFile[]> {
    // Return mock data
    return [
        {
            file: { path: 'test', url: 'test', name: 'test', byteSize: 100, isDirectory: false },
            repository: { id: '1', name: 'test' },
        },
    ]
}

export async function getRemoteSymbols(
    repositories: string[],
    query: string
): Promise<FuzzyFindSymbol[]> {
    // Return mock data
    return [
        {
            symbols: [
                {
                    name: 'test',
                    location: {
                        range: { start: { line: 1 }, end: { line: 1 } },
                        resource: { path: 'test' },
                    },
                },
            ],
            repository: { id: '1', name: 'test' },
        },
    ]
}

export async function getRepoIds(
    names: string[],
    first: number,
    signal?: AbortSignal
): Promise<RemoteRepo[]> {
    // Return mock data
    return []
}

export async function getRepoList({
    first,
    after,
    query,
}: {
    first: number
    after?: string
    query?: string
}): Promise<RepoListResponse | Error> {
    // Return mock data
    return {
        repositories: {
            nodes: [{ name: 'test', id: '1' }],
            pageInfo: { endCursor: null },
        },
    }
}

export async function queryPrompts({
    query,
    first,
    recommendedOnly,
    tags,
    signal,
    orderByMultiple,
    owner,
    includeViewerDrafts,
    builtinOnly,
}: {
    query?: string
    first: number | undefined
    recommendedOnly?: boolean
    tags?: string[]
    signal?: AbortSignal
    orderByMultiple?: PromptsOrderBy[]
    owner?: string
    includeViewerDrafts?: boolean
    builtinOnly?: boolean
}): Promise<Prompt[]> {
    // Return mock data
    return []
}

export async function searchRepoSuggestions(query: string): Promise<SuggestionsRepo[]> {
    // Return mock data
    return [
        {
            id: '1',
            name: 'test',
            stars: 10,
            url: 'https://github.com/test',
        },
    ]
}
