export interface GetTechDocContentParams {
    nodeKind: string
    path: string
    primaryAssetId: string
    versionId: string
}
export type DocumentSet = {
    short: {
        single_sentence: string
        single_paragraph_document: {
            content: string
            id: string
            __typename: string
        }
        __typename: string
    }
    long_document: {
        content: string
        id: string
        __typename: string
    }
    quickstart: {
        entry_document: null
        __typename: string
    }
    code: {
        metadata: {
            size: number
            sloc: number
            extension: string
            is_binary: boolean
            is_hex: boolean
            is_analyzable: boolean
            is_blacklisted: boolean
            __typename: string
        }
        __typename: string
    }
    __typename: string
}

export interface GetTreeParams {
    codebaseId: string
    versionId: string
}
export type Tree = {
    id: string
    name: string
    path: string
    kind: string
    children: string[]
    __typename: string
}[]
