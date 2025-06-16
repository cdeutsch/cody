// CD: this seems less than ideal to tack on another value to the PrimaryAssetType.
// We can't use `PrimaryAsset.CODEBASE` because the compiler doesn't support it.
export type SourceContentType = 'CODEBASE' | 'FILE' | 'CODEBASE_DIRECTORY'

export const contentTypeLabels: Record<SourceContentType, any> = {
    CODEBASE: {
        plural: 'Codebases',
        singular: 'Codebase',
    },
    FILE: {
        plural: 'PDFs',
        singular: 'PDF',
    },
    CODEBASE_DIRECTORY: {
        plural: 'Codebase Directories',
        singular: 'Codebase Directory',
    },
}

export const getLabelForContentType = (contentType: SourceContentType, plural = false) => {
    if (plural) {
        return contentTypeLabels[contentType]?.plural ?? contentType
    }
    return contentTypeLabels[contentType]?.singular ?? contentType
}
