import type { Response as NodeResponse } from 'node-fetch'
import type { URI } from 'vscode-uri'

export type BrowserOrNodeResponse = Response | NodeResponse

export type FuzzyFindFile = {
    file: {
        path: string
        url: string
        name: string
        byteSize: number
        isDirectory: boolean
    }
    repository: { id: string; name: string }
}

export type FuzzyFindSymbol = {
    symbols: {
        name: string
        location: {
            range: {
                start: { line: number }
                end: { line: number }
            }
            resource: {
                path: string
            }
        }
    }[]
    repository: { id: string; name: string }
}

export interface RepoListResponse {
    repositories: {
        nodes: { name: string; id: string }[]
        pageInfo: {
            endCursor: string | null
        }
    }
}

export interface RemoteRepo {
    /** The name of the repository (e.g., `github.com/foo/bar`). */
    name: string

    /** The GraphQL ID of the repository on the Sourcegraph instance. */
    id: string
}

export interface SuggestionsRepo {
    id: string
    name: string
    stars: number
    url: string
}

export interface RepoSuggestionsSearchResponse {
    search: {
        results: {
            repositories: Array<SuggestionsRepo>
        }
    } | null
}

export interface NLSSearchFileMatch {
    __typename: 'FileMatch'
    repository: {
        id: string
        name: string
    }
    file: {
        url: string
        path: string
        commit: {
            oid: string
        }
    }
    chunkMatches?: {
        content: string
        contentStart: Position
        ranges: Range[]
    }[]
    pathMatches?: Range[]
    symbols?: {
        name: string
        location: {
            range: Range
        }
    }[]
}

export type NLSSearchResult = NLSSearchFileMatch | { __typename: 'unknown' }

export interface NLSSearchDynamicFilter {
    value: string
    label: string
    count: number
    kind: NLSSearchDynamicFilterKind | string
}

export type NLSSearchDynamicFilterKind = 'repo' | 'lang' | 'type' | 'file'

export interface NLSSearchResponse {
    search: {
        results: {
            dynamicFilters?: NLSSearchDynamicFilter[]
            results: NLSSearchResult[]
        }
    }
}

export interface RepositoryIdResponse {
    repository: { id: string } | null
}

export interface RepositoryIdsResponse {
    repositories: {
        nodes: { name: string; id: string }[]
    }
}

export interface Position {
    line: number
    character: number
}

export interface Range {
    start: Position
    end: Position
}

/**
 * Experimental API.
 */
export interface ContextSearchResult {
    repoName: string
    commit: string
    uri: URI
    path: string
    startLine: number
    endLine: number
    content: string
    ranges: Range[]
}

/**
 * A prompt that can be shared and reused. See Prompt in the Sourcegraph GraphQL API.
 */
export interface Prompt {
    id: string
    name: string
    nameWithOwner: string
    recommended: boolean
    owner?: {
        namespaceName: string
    }
    description?: string
    draft: boolean
    autoSubmit?: boolean
    builtin?: boolean
    mode?: PromptMode
    definition: {
        text: string
    }
    url: string
    createdBy?: {
        id: string
        username: string
        displayName: string
        avatarURL: string
    }
}

export enum PromptMode {
    CHAT = 'CHAT',
    EDIT = 'EDIT',
    INSERT = 'INSERT',
}
