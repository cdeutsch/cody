import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react'

import {
    type ChatMessage,
    type ClientConfig,
    type DefaultContext,
    type PrimaryAssetRecord,
    PromptString,
} from '@sourcegraph/cody-shared'
import styles from './App.module.css'
import { AuthPage } from './AuthPage'
import { LoadingPage } from './LoadingPage'
import { useClientActionDispatcher } from './client/clientState'

import { ExtensionAPIProviderFromVSCodeAPI } from '@sourcegraph/prompt-editor'
import type { ExtensionTranscriptMessage } from '../src/chat/protocol'
import { CodyPanel } from './CodyPanel'
import { AuthenticationErrorBanner } from './components/AuthenticationErrorBanner'
import { useSuppressKeys } from './components/hooks'
import { UserProvider } from './contexts/UserContext'
import { View } from './tabs'
import type { VSCodeWrapper } from './utils/VSCodeApi'
import { ComposedWrappers, type Wrapper } from './utils/composeWrappers'
import { updateDisplayPathEnvInfoForWebview } from './utils/displayPathEnvInfo'
import { ClientConfigProvider } from './utils/useClientConfig'
import { type Config, ConfigProvider } from './utils/useConfig'
import { useDevicePixelRatioNotifier } from './utils/useDevicePixelRatio'
import { LinkOpenerProvider } from './utils/useLinkOpener'

export const App: React.FunctionComponent<{ vscodeAPI: VSCodeWrapper }> = ({ vscodeAPI }) => {
    const [config, setConfig] = useState<Config | null>(null)
    const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null)
    // NOTE: View state will be set by the extension host during initialization.
    const [view, setView] = useState<View>()
    const [messageInProgress, setMessageInProgress] = useState<ChatMessage | null>(null)
    const [primaryAsset, setPrimaryAsset] = useState<PrimaryAssetRecord | undefined>(undefined)
    const [primaryAssetLoaded, setPrimaryAssetLoaded] = useState<boolean>(false)
    const [chatID, setChatID] = useState<string | undefined>(undefined)

    const [transcript, setTranscript] = useState<ChatMessage[]>([])

    const [errorMessages, setErrorMessages] = useState<string[]>([])

    const dispatchClientAction = useClientActionDispatcher()

    useSuppressKeys()

    // console.debug('messageInProgress', messageInProgress);
    // console.debug('transcript', transcript);

    useEffect(
        () =>
            vscodeAPI.onMessage((message: any) => {
                switch (message.type) {
                    case 'ui/theme': {
                        document.documentElement.dataset.ide = message.agentIDE
                        const rootStyle = document.documentElement.style
                        for (const [name, value] of Object.entries(message.cssVariables || {})) {
                            rootStyle.setProperty(name, value as string)
                        }
                        break
                    }
                    case 'transcript': {
                        const transcriptMsg = message as ExtensionTranscriptMessage
                        const deserializedMessages = transcriptMsg.messages.map(
                            PromptString.unsafe_deserializeChatMessage
                        )
                        if (transcriptMsg.isMessageInProgress) {
                            const msgLength = deserializedMessages.length - 1
                            setTranscript(deserializedMessages.slice(0, msgLength))
                            setMessageInProgress(deserializedMessages[msgLength])
                        } else {
                            setTranscript(deserializedMessages)
                            setMessageInProgress(null)
                        }
                        setPrimaryAssetLoaded(transcriptMsg.primaryAssetLoaded || false)
                        setPrimaryAsset(transcriptMsg.primaryAsset)
                        setChatID(transcriptMsg.chatID)
                        vscodeAPI.setState(transcriptMsg.chatID)
                        break
                    }
                    case 'config':
                        setConfig(message)
                        updateDisplayPathEnvInfoForWebview(message.workspaceFolderUris)
                        // Reset to the default view (Chat) for unauthenticated users.
                        if (view && view !== View.Chat && !message.authStatus?.authenticated) {
                            setView(View.Chat)
                        }
                        break
                    case 'clientConfig':
                        if (message.clientConfig) {
                            setClientConfig(message.clientConfig)
                        }
                        break
                    case 'clientAction':
                        dispatchClientAction(message)
                        break
                    case 'errors':
                        setErrorMessages(prev => {
                            // Check for duplicate errors.
                            if (prev.includes(message.errors)) {
                                return prev
                            }

                            const newErrors = [...prev, message.errors]
                            return newErrors.slice(-5)
                        })
                        break
                    case 'view':
                        setView(message.view)
                        break
                }
            }),
        [view, vscodeAPI, dispatchClientAction]
    )

    useEffect(() => {
        // Notify the extension host that we are ready to receive events
        vscodeAPI.postMessage({ command: 'ready' })
    }, [vscodeAPI])

    useEffect(() => {
        if (!view) {
            vscodeAPI.postMessage({ command: 'initialized' })
            return
        }
    }, [view, vscodeAPI])

    const loginRedirect = useCallback(() => {
        // We do not change the view here. We want to keep presenting the
        // login buttons until we get a token so users don't get stuck if
        // they close the browser during an auth flow.
        vscodeAPI.postMessage({
            command: 'auth',
            authKind: 'simplified-onboarding',
        })
    }, [vscodeAPI])

    // Notify the extension host of the device pixel ratio
    // Currently used for image generation in auto-edit.
    useDevicePixelRatioNotifier()

    const wrappers = useMemo<Wrapper[]>(
        () => getAppWrappers({ vscodeAPI, config, clientConfig }),
        [vscodeAPI, config, clientConfig]
    )

    // Wait for all the data to be loaded before rendering Chat View
    if (!view || !config) {
        return <LoadingPage />
    }

    return (
        <ComposedWrappers wrappers={wrappers}>
            {view === View.Login || !config.authStatus.authenticated ? (
                <div className={styles.outerContainer}>
                    {!config.authStatus.authenticated && config.authStatus.error && (
                        <AuthenticationErrorBanner errorMessage={config.authStatus.error} />
                    )}
                    <AuthPage onLogin={loginRedirect} />
                </div>
            ) : (
                <UserProvider user={config.authStatus.user}>
                    <CodyPanel
                        view={view}
                        setView={setView}
                        configuration={config}
                        errorMessages={errorMessages}
                        setErrorMessages={setErrorMessages}
                        messageInProgress={messageInProgress}
                        transcript={transcript}
                        vscodeAPI={vscodeAPI}
                        primaryAsset={primaryAsset}
                        primaryAssetLoaded={primaryAssetLoaded}
                        chatID={chatID}
                    />
                </UserProvider>
            )}
        </ComposedWrappers>
    )
}

interface GetAppWrappersOptions {
    vscodeAPI: VSCodeWrapper
    config: Config | null
    clientConfig: ClientConfig | null
    staticDefaultContext?: DefaultContext
}

export function getAppWrappers({
    vscodeAPI,
    config,
    clientConfig,
    staticDefaultContext,
}: GetAppWrappersOptions): Wrapper[] {
    return [
        {
            component: ExtensionAPIProviderFromVSCodeAPI,
            props: { vscodeAPI, staticDefaultContext },
        } satisfies Wrapper<any, ComponentProps<typeof ExtensionAPIProviderFromVSCodeAPI>>,
        {
            component: ConfigProvider,
            props: { value: config },
        } satisfies Wrapper<any, ComponentProps<typeof ConfigProvider>>,
        {
            component: ClientConfigProvider,
            props: { value: clientConfig },
        } satisfies Wrapper<any, ComponentProps<typeof ClientConfigProvider>>,
        {
            component: LinkOpenerProvider,
            props: { vscodeAPI },
        } satisfies Wrapper<any, ComponentProps<typeof LinkOpenerProvider>>,
    ]
}
