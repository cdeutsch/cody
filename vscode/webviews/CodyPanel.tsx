import {
    type AuthStatus,
    type ChatMessage,
    DriverIDE,
    type PrimaryAssetRecord,
    type WebviewToExtensionAPI,
    firstValueFrom,
} from '@sourcegraph/cody-shared'
import { useExtensionAPI } from '@sourcegraph/prompt-editor'
import type React from 'react'
import { type FunctionComponent, useEffect, useMemo, useRef } from 'react'
import type { ConfigurationSubsetForWebview, LocalEnv } from '../src/chat/protocol'
import styles from './App.module.css'
import { Chat } from './Chat'
import { useClientActionDispatcher } from './client/clientState'
import { StateDebugOverlay } from './components/StateDebugOverlay'
import { TabContainer, TabRoot } from './components/shadcn/ui/tabs'
import { HistoryTab, TabsBar, View } from './tabs'
import type { VSCodeWrapper } from './utils/VSCodeApi'
import { TabViewContext } from './utils/useTabView'

interface CodyPanelProps {
    view: View
    setView: (view: View) => void
    configuration: {
        config: LocalEnv & ConfigurationSubsetForWebview
        authStatus: AuthStatus
    }
    messageInProgress: ChatMessage | null
    transcript: ChatMessage[]
    errorMessages: string[]
    setErrorMessages: (errors: string[]) => void
    showIDESnippetActions?: boolean
    onExternalApiReady?: (api: CodyExternalApi) => void
    onExtensionApiReady?: (api: WebviewToExtensionAPI) => void
    vscodeAPI: Pick<VSCodeWrapper, 'postMessage' | 'onMessage'>
    primaryAsset?: PrimaryAssetRecord
    primaryAssetLoaded?: boolean
    chatID?: string
}

/**
 * The Driver tab panel, with tabs for chat, history, prompts, etc.
 */
export const CodyPanel: FunctionComponent<CodyPanelProps> = ({
    view,
    setView,
    configuration: { config },
    errorMessages,
    setErrorMessages,
    showIDESnippetActions,
    messageInProgress,
    transcript,
    vscodeAPI,
    onExternalApiReady,
    onExtensionApiReady,
    primaryAsset,
    primaryAssetLoaded,
    chatID,
}) => {
    const tabContainerRef = useRef<HTMLDivElement>(null)

    const externalAPI = useExternalAPI()
    const api = useExtensionAPI()

    useEffect(() => {
        onExternalApiReady?.(externalAPI)
    }, [onExternalApiReady, externalAPI])

    useEffect(() => {
        onExtensionApiReady?.(api)
    }, [onExtensionApiReady, api])

    return (
        <TabViewContext.Provider value={useMemo(() => ({ view, setView }), [view, setView])}>
            <TabRoot
                defaultValue={View.Chat}
                value={view}
                orientation="vertical"
                className={styles.outerContainer}
            >
                {/* Hide tab bar in editor chat panels. */}
                {config.webviewType !== 'editor' && (
                    <TabsBar
                        currentView={view}
                        setView={setView}
                        showOpenInEditor={!!config?.multipleWebviewsEnabled}
                    />
                )}
                {errorMessages && <ErrorBanner errors={errorMessages} setErrors={setErrorMessages} />}
                <TabContainer value={view} ref={tabContainerRef} data-scrollable>
                    {view === View.Chat && (
                        <Chat
                            key={chatID}
                            chatEnabled={true}
                            messageInProgress={messageInProgress}
                            transcript={transcript}
                            vscodeAPI={vscodeAPI}
                            showIDESnippetActions={showIDESnippetActions}
                            scrollableParent={tabContainerRef.current}
                            setView={setView}
                            primaryAsset={primaryAsset}
                            primaryAssetLoaded={primaryAssetLoaded}
                            chatID={chatID}
                        />
                    )}
                    {view === View.History && (
                        <HistoryTab
                            IDE={DriverIDE.VSCode}
                            extensionAPI={api}
                            setView={setView}
                            webviewType={config.webviewType}
                            multipleWebviewsEnabled={config.multipleWebviewsEnabled}
                        />
                    )}
                </TabContainer>
                <StateDebugOverlay />
            </TabRoot>
        </TabViewContext.Provider>
    )
}

const ErrorBanner: React.FunctionComponent<{ errors: string[]; setErrors: (errors: string[]) => void }> =
    ({ errors, setErrors }) => (
        <div className={styles.errorContainer}>
            {errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: error strings might not be unique, so we have no natural id
                <div key={i} className={styles.error}>
                    <span>{error}</span>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={() => setErrors(errors.filter(e => e !== error))}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    )

interface ExternalPrompt {
    text: string
    autoSubmit: boolean
    mode?: ChatMessage['intent']
}

interface CodyExternalApi {
    runPrompt: (action: ExternalPrompt) => Promise<void>
}

function useExternalAPI(): CodyExternalApi {
    const dispatchClientAction = useClientActionDispatcher()
    const extensionAPI = useExtensionAPI()

    return useMemo(
        () => ({
            runPrompt: async (prompt: ExternalPrompt) => {
                const promptEditorState = await firstValueFrom(
                    extensionAPI.hydratePromptMessage(prompt.text)
                )

                dispatchClientAction(
                    {
                        editorState: promptEditorState,
                        submitHumanInput: prompt.autoSubmit,
                        setLastHumanInputIntent: prompt.mode ?? 'chat',
                    },
                    // Buffer because PromptEditor is not guaranteed to be mounted after the `setView`
                    // call above, and it needs to be mounted to receive the action.
                    { buffer: true }
                )
            },
        }),
        [extensionAPI, dispatchClientAction]
    )
}
