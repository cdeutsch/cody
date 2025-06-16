import type { Context } from '@opentelemetry/api'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type {
    AuthenticatedAuthStatus,
    ChatMessage,
    DriverIDE,
    PrimaryAssetRecord,
} from '@sourcegraph/cody-shared'

import styles from './Chat.module.css'
import { Transcript, focusLastHumanMessageEditor } from './chat/Transcript'
import { ScrollDown } from './components/ScrollDown'
import type { View } from './tabs'
import type { VSCodeWrapper } from './utils/VSCodeApi'
import { useUserAccountInfo } from './utils/useConfig'

interface ChatboxProps {
    chatEnabled: boolean
    messageInProgress: ChatMessage | null
    transcript: ChatMessage[]
    vscodeAPI: Pick<VSCodeWrapper, 'postMessage' | 'onMessage'>
    scrollableParent?: HTMLElement | null
    showWelcomeMessage?: boolean
    showIDESnippetActions?: boolean
    setView: (view: View) => void
    isWorkspacesUpgradeCtaEnabled?: boolean
    primaryAsset?: PrimaryAssetRecord
    primaryAssetLoaded?: boolean
    chatID?: string
}

export const Chat: React.FunctionComponent<React.PropsWithChildren<ChatboxProps>> = ({
    messageInProgress,
    transcript,
    vscodeAPI,
    chatEnabled = true,
    scrollableParent,
    showWelcomeMessage = true,
    showIDESnippetActions = true,
    setView,
    isWorkspacesUpgradeCtaEnabled,
    primaryAsset,
    primaryAssetLoaded,
    chatID,
}) => {
    const transcriptRef = useRef(transcript)
    transcriptRef.current = transcript

    const userInfo = useUserAccountInfo()

    const copyButtonOnSubmit = useCallback(
        (text: string, eventType: 'Button' | 'Keydown' = 'Button') => {
            const op = 'copy'
            // remove the additional newline added by the text area at the end of the text

            const code = eventType === 'Button' ? text.replace(/\n$/, '') : text
            // Log the event type and text to telemetry in chat view

            vscodeAPI.postMessage({
                command: op,
                eventType,
                text: code,
            })
        },
        [vscodeAPI]
    )

    const postMessage = useCallback<ApiPostMessage>(msg => vscodeAPI.postMessage(msg), [vscodeAPI])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            // Esc to abort the message in progress.
            if (event.key === 'Escape' && messageInProgress) {
                vscodeAPI.postMessage({ command: 'abort' })
            }

            // NOTE(sqs): I have a keybinding on my Linux machine Super+o to switch VS Code editor
            // groups. This makes it so that that keybinding does not also input the letter 'o'.
            // This is a workaround for (arguably) a VS Code issue.
            if (event.metaKey && event.key === 'o') {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [vscodeAPI, messageInProgress])

    // Re-focus the input when the webview (re)gains focus if it was focused before the webview lost
    // focus. This makes it so that the user can easily switch back to the Driver view and keep
    // typing.
    useEffect(() => {
        const onFocus = (): void => {
            // This works because for some reason Electron maintains the Selection but not the
            // focus.
            const sel = window.getSelection()
            const focusNode = sel?.focusNode
            const focusElement = focusNode instanceof Element ? focusNode : focusNode?.parentElement
            const focusEditor = focusElement?.closest<HTMLElement>('[data-lexical-editor="true"]')
            if (focusEditor) {
                focusEditor.focus({ preventScroll: true })
            }
        }
        window.addEventListener('focus', onFocus)
        return () => {
            window.removeEventListener('focus', onFocus)
        }
    }, [])

    const handleScrollDownClick = useCallback(() => {
        // Scroll to the bottom instead of focus input for unsent message
        // it's possible that we just want to scroll to the bottom in case of
        // welcome message screen
        if (transcript.length === 0) {
            return
        }

        focusLastHumanMessageEditor()
    }, [transcript])
    const [activeChatContext, setActiveChatContext] = useState<Context>()

    return (
        <>
            {!chatEnabled && <div className={styles.chatDisabled}>Driver chat is disabled.</div>}
            <Transcript
                activeChatContext={activeChatContext}
                setActiveChatContext={setActiveChatContext}
                transcript={transcript}
                messageInProgress={messageInProgress}
                copyButtonOnSubmit={copyButtonOnSubmit}
                userInfo={userInfo}
                chatEnabled={chatEnabled}
                postMessage={postMessage}
                primaryAsset={primaryAsset}
                primaryAssetLoaded={primaryAssetLoaded}
                chatID={chatID}
            />
            {/* {transcript.length === 0 && showWelcomeMessage && (
                <>
                    <WelcomeMessage IDE={userInfo.IDE} setView={setView} />
                    {isWorkspacesUpgradeCtaEnabled && userInfo.IDE !== DriverIDE.Web && (
                        <div className="tw-absolute tw-bottom-0 tw-left-1/2 tw-transform tw--translate-x-1/2 tw-w-[95%] tw-z-1 tw-mb-4 tw-max-h-1/2">
                            <WelcomeNotice />
                        </div>
                    )}
                </>
            )} */}

            {scrollableParent && (
                <ScrollDown scrollableParent={scrollableParent} onClick={handleScrollDownClick} />
            )}
        </>
    )
}

export interface UserAccountInfo {
    user: Pick<AuthenticatedAuthStatus, 'user'>
    IDE: DriverIDE
}

export type ApiPostMessage = (message: any) => void
