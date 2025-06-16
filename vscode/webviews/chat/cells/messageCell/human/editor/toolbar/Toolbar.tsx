import type {
    ChatMessage,
    ContextItemMedia,
    PrimaryAssetRecord,
    WebviewToExtensionAPI,
} from '@sourcegraph/cody-shared'
import { isMacOS } from '@sourcegraph/cody-shared'
import clsx from 'clsx'
import { LoaderCircleIcon, SlidersHorizontalIcon, TriangleAlertIcon } from 'lucide-react'
import { type FunctionComponent, useCallback, useEffect, useMemo, useRef } from 'react'
import { ToolbarPopoverItem } from '../../../../../../components/shadcn/ui/toolbar'
import toolbarStyles from '../../../../../../components/shadcn/ui/toolbar.module.css'
import { cn } from '../../../../../../components/shadcn/utils'
import { DriverTuner } from '../../../../../../webapp-frontend/components/UserDefinedScope/DriverTuner'
import { mapToSourceAssetRecord } from '../../../../../../webapp-frontend/components/UserDefinedScope/SourceAssetRecord'
import { MediaUploadButton } from './MediaUploadButton'
import { SubmitButton, type SubmitButtonState } from './SubmitButton'

/**
 * The toolbar for the human message editor.
 */
export const Toolbar: FunctionComponent<{
    isEditorFocused: boolean

    onSubmitClick: (intent?: ChatMessage['intent']) => void
    submitState: SubmitButtonState

    /** Handler for clicks that are in the "gap" (dead space), not any toolbar items. */
    onGapClick?: () => void

    focusEditor?: () => void

    hidden?: boolean
    className?: string

    intent?: ChatMessage['intent']

    extensionAPI: WebviewToExtensionAPI

    omniBoxEnabled: boolean
    onMediaUpload?: (mediaContextItem: ContextItemMedia) => void

    setLastManuallySelectedIntent?: (intent: ChatMessage['intent']) => void

    primaryAsset?: PrimaryAssetRecord
    primaryAssetLoaded?: boolean

    handleTunerSubmit: (sourceNodeIds: string[]) => void
    sourceNodeIds?: string[]
    onTunerOpenChange?: (open: boolean) => void
}> = ({
    isEditorFocused,
    onSubmitClick,
    submitState,
    onGapClick,
    focusEditor,
    hidden,
    className,
    intent,
    extensionAPI,
    omniBoxEnabled,
    onMediaUpload,
    setLastManuallySelectedIntent,
    primaryAsset,
    primaryAssetLoaded,
    handleTunerSubmit,
    sourceNodeIds,
    onTunerOpenChange,
}) => {
    /**
     * If the user clicks in a gap or on the toolbar outside of any of its buttons, report back to
     * parent via {@link onGapClick}.
     */
    const onMaybeGapClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            const targetIsToolbarButton = event.target !== event.currentTarget
            if (!targetIsToolbarButton) {
                event.preventDefault()
                event.stopPropagation()
                onGapClick?.()
            }
        },
        [onGapClick]
    )

    const isImageUploadEnabled = false

    const modelSelectorRef = useRef<{ open: () => void; close: () => void } | null>(null)
    const promptSelectorRef = useRef<{ open: () => void; close: () => void } | null>(null)

    // Set up keyboard event listener
    useEffect(() => {
        const handleKeyboardShortcuts = (event: KeyboardEvent) => {
            // Model selector (⌘M on Mac, ctrl+M on other platforms)
            // metaKey is set to cmd(⌘) on macOS, and windows key on other platforms
            if ((isMacOS() ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'm') {
                event.preventDefault()
                modelSelectorRef?.current?.open()
            }
            // Prompt selector (⌘/ on Mac, ctrl+/ on other platforms)
            else if ((isMacOS() ? event.metaKey : event.ctrlKey) && event.key === '/') {
                event.preventDefault()
                promptSelectorRef?.current?.open()
            }
            // Close dropdowns on Escape
            else if (event.key === 'Escape') {
                modelSelectorRef?.current?.close()
                promptSelectorRef?.current?.close()
            }
        }

        window.addEventListener('keydown', handleKeyboardShortcuts)
        return () => window.removeEventListener('keydown', handleKeyboardShortcuts)
    }, [])

    // if (models?.length < 2) {
    //   return null;
    // }

    const isTuned = sourceNodeIds?.length && sourceNodeIds.length > 0
    const tunerItem = useMemo(() => {
        if (!primaryAsset) {
            return undefined
        }
        const item = mapToSourceAssetRecord(primaryAsset)
        item.children = sourceNodeIds

        return item
    }, [primaryAsset, sourceNodeIds])

    return (
        <menu
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
            role="toolbar"
            aria-hidden={hidden}
            hidden={hidden}
            className={clsx(
                'tw-flex tw-items-center tw-justify-between tw-flex-wrap-reverse tw-border-t tw-border-t-border tw-gap-2 [&_>_*]:tw-flex-shrink-0',
                className
            )}
            onMouseDown={onMaybeGapClick}
            onClick={onMaybeGapClick}
            onKeyDown={() => null}
            data-testid="chat-editor-toolbar"
        >
            <div className="tw-flex tw-items-center">
                {onMediaUpload && isImageUploadEnabled && (
                    <MediaUploadButton
                        onMediaUpload={onMediaUpload}
                        isEditorFocused={isEditorFocused}
                        submitState={submitState}
                        className={`tw-opacity-60 focus-visible:tw-opacity-100 hover:tw-opacity-100 tw-mr-2 tw-gap-0.5 ${toolbarStyles.button} ${toolbarStyles.buttonSmallIcon}`}
                    />
                )}
                <ToolbarPopoverItem
                    role="menu"
                    iconEnd={null}
                    className={cn(
                        'tw-justify-between',
                        className,
                        isTuned
                            ? 'tw-bg-status-bar-item-remote-background tw-text-status-bar-item-remote-foreground'
                            : 'tw-bg-inherit'
                    )}
                    aria-label="Tuning Menu Button"
                    disabled={!primaryAsset}
                    popoverContent={close => (
                        <DriverTuner
                            setTunerOpen={close}
                            tunerItem={tunerItem}
                            handleAddAsset={() => {}}
                            handleRemoveAsset={() => {}}
                            handleTunerSubmit={handleTunerSubmit}
                        />
                    )}
                    popoverRootProps={{ onOpenChange: onTunerOpenChange }}
                    popoverContentProps={{
                        className: '!tw-p-2 tw-mr-6',
                        // onKeyDown: onKeyDown,
                        onCloseAutoFocus: event => {
                            event.preventDefault()
                        },
                    }}
                >
                    {primaryAsset ? (
                        <>
                            <SlidersHorizontalIcon className="tw-mr-1 !tw-size-6" />
                            {isTuned ? 'Tuned' : 'Tune'}
                        </>
                    ) : primaryAssetLoaded ? (
                        <>
                            <TriangleAlertIcon className="!tw-size-6" /> Codebase not found in Driver
                        </>
                    ) : (
                        <>
                            <LoaderCircleIcon className="!tw-size-6 tw-animate-spin" /> Loading
                            codebase...
                        </>
                    )}
                </ToolbarPopoverItem>
            </div>
            <div className="tw-flex-1 tw-flex tw-justify-end">
                <SubmitButton onClick={onSubmitClick} state={submitState} />
            </div>
        </menu>
    )
}
