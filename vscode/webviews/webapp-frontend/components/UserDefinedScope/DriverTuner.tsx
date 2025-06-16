import { Check, Loader } from 'lucide-react'
import { useMemo, useReducer } from 'react'

import { useExtensionAPI, useObservable } from '@sourcegraph/prompt-editor'
import { Button } from '../../../components/shadcn/ui/button'
import type { SourceAssetRecord } from './SourceAssetRecord'
import { DriverTree } from './Tree/DriverTree'
import { buildTreeData } from './Tree/TreeUtils'

function reducer(state: string[], newState: string[]): string[] {
    return newState
}

interface DriverTunerProps {
    setTunerOpen: (open: boolean) => void
    handleAddAsset: (asset: SourceAssetRecord) => void
    handleRemoveAsset: (primaryAssetId: string, versionId?: string) => void
    tunerItem?: SourceAssetRecord
    handleTunerSubmit: (sourceNodeIds: string[]) => void
}

export const DriverTuner: React.FC<DriverTunerProps> = ({
    setTunerOpen,
    handleAddAsset,
    handleRemoveAsset,
    tunerItem,
    handleTunerSubmit,
}) => {
    const [checked, setChecked] = useReducer(reducer, [])

    // const {
    //   data: versionsData,
    //   isLoading: isLoadingVersionsData,
    //   error: versionsError,
    // } = useGetVersionsQuery(
    //   {
    //     id: tunerItem?.versionId,
    //     limit: 1,
    //     sort_by: 'created_at',
    //   },
    //   { enabled: !!tunerItem?.primary_asset_id }
    // );

    // const versions = versionsData?.results;

    // const version = versions?.find((version) => version.id === tunerItem?.versionId);

    const isLoadingVersionsData = false
    const versionsError = null

    const codebase_node_id = tunerItem?.most_recent_version?.root_node?.id

    const extensionsAPI = useExtensionAPI()
    const {
        value: tree,
        done,
        error,
    } = useObservable(
        useMemo(
            () =>
                extensionsAPI.getTree({
                    codebaseId: tunerItem?.most_recent_version?.primary_asset_id ?? '',
                    versionId: tunerItem?.versionId ?? '',
                }),
            [extensionsAPI, tunerItem]
        )
    )

    const loading = !done

    const noTree = !tree?.[0]
    let defaultValues = tunerItem?.children ?? []
    if (tunerItem?.children?.length === 0) {
        defaultValues = [tunerItem.node_id]
    }

    const actualLoading = loading || isLoadingVersionsData

    const submitTuner = () => {
        if (!tunerItem) return
        // remove previous element
        handleRemoveAsset(tunerItem.primary_asset_id, tunerItem.versionId)
        // add new element
        const newTuner: SourceAssetRecord = { ...tunerItem, children: [] }
        newTuner.children = checked
        handleAddAsset(newTuner)
        handleTunerSubmit(checked)
        setTunerOpen(false)
    }

    const treeData = useMemo(
        () => (tree && codebase_node_id ? buildTreeData(tree, codebase_node_id) : null),
        [tree, codebase_node_id]
    )

    const getSelectionCount = (): string | number | false => {
        if (loading) return false
        const firstChecked = checked?.[0]
        const entireCodebase = firstChecked === codebase_node_id
        if (entireCodebase) {
            return 'Codebase'
        }
        if (checked.length > 0) {
            return checked.length
        }
        return false
    }

    const checkedCount = getSelectionCount()

    return (
        <div className="driver-tuner">
            <div className="tw-flex tw-items-center tw-justify-between">
                <div className="tw-pb-2 tw-pl-1 tw-font-light tw-uppercase">Driver Tuning</div>
                {checkedCount && (
                    <span className="tw-text-muted-foreground">{checkedCount} selected</span>
                )}
            </div>
            <div className="react-suite-component-wrapper tw-relative tw-h-[366px]">
                {actualLoading && (
                    <div className="tw-absolute tw-inset-0 tw-z-10 tw-flex tw-items-center tw-justify-center tw-bg-opacity-75">
                        <div className="tw-loader">
                            <Loader
                                className="tw-animate-spin"
                                size={32}
                                data-testid="loading-indicator"
                            />
                        </div>
                    </div>
                )}
                {!actualLoading && noTree && <div>No tree available for this codebase</div>}
                {error && versionsError && <div>Error loading tree</div>}
                {treeData?.id && (
                    <DriverTree data={treeData} setChecked={setChecked} defaultValues={defaultValues} />
                )}
            </div>
            <Button
                disabled={checked.length === 0 || loading}
                onClick={submitTuner}
                className="tw-mt-2 tw-w-full tw-self-end"
            >
                <Check className="tw-size-8" />
                Accept Tuning
            </Button>
        </div>
    )
}
