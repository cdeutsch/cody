export type TagType = 'tag'

export interface Tag {
    name: string
    hex_color: string
    type: TagType
}

export interface TagResult {
    id: string
    name: string
    type: TagType
    hex_color?: string
    color?: string
    organization_id: string
    created_at: string
    created_by?: string
    updated_at: string
    updated_by?: string
}

export interface ContentTagsResponse {
    results: TagResult[]
}

export interface TagGetResponse {
    results: TagResult[]
    offset: number
    limit: number
    count: number
}

export interface AssociateTagWithContentParams {
    tagId: string
    primaryAssetId: string
}

export interface TagGetParams {
    limit?: number
    offset?: number
    name?: string
    // When we had collections you could have type: 'collection' or 'tag'
    // Now that collections are gone, it's confusing so I'm removing this param for now since it should always be 'tag'.
    // type: TagType;
    name__ilike?: string
}

export interface DeleteTagParams {
    tagId: string
}

export interface UpdateTagParams {
    tagId: string
    tag: {
        name: string
        hex_color: string
    }
}
