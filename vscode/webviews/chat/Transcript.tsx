import {
    type ChatMessage,
    type PrimaryAssetRecord,
    type SerializedPromptEditorValue,
    deserializeContextItem,
    isAbortErrorOrSocketHangUp,
} from '@sourcegraph/cody-shared'
import type { PromptEditorRefAPI } from '@sourcegraph/prompt-editor'
import { clsx } from 'clsx'
import { isEqual } from 'lodash'
import {
    type FC,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react'
import type { UserAccountInfo } from '../Chat'
import type { ApiPostMessage } from '../Chat'
import { getVSCodeAPI } from '../utils/VSCodeApi'
import type { CodeBlockActionsProps } from './ChatMessageContent/ChatMessageContent'
import {
    AssistantMessageCell,
    makeHumanMessageInfo,
} from './cells/messageCell/assistant/AssistantMessageCell'
import { HumanMessageCell } from './cells/messageCell/human/HumanMessageCell'

import type { Context } from '@opentelemetry/api'
import { useLocalStorage } from '../components/hooks'
import { AgenticContextCell } from './cells/agenticCell/AgenticContextCell'
import { ToolStatusCell } from './cells/toolCell/ToolStatusCell'
import { LoadingDots } from './components/LoadingDots'
import { LastEditorContext } from './context'

interface TranscriptProps {
    activeChatContext?: Context
    setActiveChatContext: (context: Context | undefined) => void
    chatEnabled: boolean
    transcript: ChatMessage[]
    userInfo: UserAccountInfo
    messageInProgress: ChatMessage | null
    postMessage?: ApiPostMessage

    copyButtonOnSubmit: CodeBlockActionsProps['copyButtonOnSubmit']
    insertButtonOnSubmit?: CodeBlockActionsProps['insertButtonOnSubmit']
    smartApply?: CodeBlockActionsProps['smartApply']
    primaryAsset?: PrimaryAssetRecord
    primaryAssetLoaded?: boolean
    chatID?: string
}

export const Transcript: FC<TranscriptProps> = props => {
    const {
        activeChatContext,
        setActiveChatContext,
        chatEnabled,
        transcript,
        userInfo,
        messageInProgress,
        postMessage,
        copyButtonOnSubmit,
        insertButtonOnSubmit,
        smartApply,
        primaryAsset,
        primaryAssetLoaded,
        chatID,
    } = props

    const interactions = useMemo(
        () => transcriptToInteractionPairs(transcript, messageInProgress),
        [transcript, messageInProgress]
    )

    const lastHumanEditorRef = useRef<PromptEditorRefAPI | null>(null)

    useEffect(() => {
        const handleCopyEvent = (event: ClipboardEvent) => {
            const selectedText = window.getSelection()?.toString() || ''
            if (!selectedText) return
            getVSCodeAPI().postMessage({
                command: 'copy',
                text: selectedText,
                eventType: 'Keydown',
            })
        }
        document.addEventListener('copy', handleCopyEvent)
        return () => {
            document.removeEventListener('copy', handleCopyEvent)
        }
    }, [])

    return (
        <div
            className={clsx('tw-px-8 tw-py-4 tw-flex tw-flex-col tw-gap-4', {
                'tw-flex-grow': transcript.length > 0,
            })}
        >
            <LastEditorContext.Provider value={lastHumanEditorRef}>
                {interactions.map((interaction, i) => (
                    <TranscriptInteraction
                        key={interaction.humanMessage.index}
                        activeChatContext={activeChatContext}
                        setActiveChatContext={setActiveChatContext}
                        chatEnabled={chatEnabled}
                        userInfo={userInfo}
                        interaction={interaction}
                        postMessage={postMessage}
                        copyButtonOnSubmit={copyButtonOnSubmit}
                        insertButtonOnSubmit={insertButtonOnSubmit}
                        isFirstInteraction={i === 0}
                        isLastInteraction={i === interactions.length - 1}
                        isLastSentInteraction={
                            i === interactions.length - 2 && interaction.assistantMessage !== null
                        }
                        priorAssistantMessageIsLoading={Boolean(
                            messageInProgress && interactions.at(i - 1)?.assistantMessage?.isLoading
                        )}
                        smartApply={smartApply}
                        editorRef={
                            // Only set the editor ref for:
                            // 1. The first unsent agentic message (index -1), or
                            // 2. The last interaction in the transcript
                            // And only when there's no message currently in progress
                            ((interaction.humanMessage.intent === 'agentic' &&
                                interaction.humanMessage.index === -1) ||
                                i === interactions.length - 1) &&
                            !messageInProgress
                                ? lastHumanEditorRef
                                : undefined
                        }
                        primaryAsset={primaryAsset}
                        primaryAssetLoaded={primaryAssetLoaded}
                        chatID={chatID}
                    />
                ))}
            </LastEditorContext.Provider>
        </div>
    )
}

/** A human-assistant message-and-response pair. */
export interface Interaction {
    /** The human message, either sent or not. */
    humanMessage: ChatMessage & { index: number; isUnsentFollowup: boolean }

    /** `null` if the {@link Interaction["humanMessage"]} has not yet been sent. */
    assistantMessage: (ChatMessage & { index: number; isLoading: boolean }) | null
}

export function transcriptToInteractionPairs(
    transcript: ChatMessage[],
    assistantMessageInProgress: ChatMessage | null
): Interaction[] {
    const pairs: Interaction[] = []
    const transcriptLength = transcript.length

    for (let i = 0; i < transcriptLength; i += 2) {
        const humanMessage = transcript[i]
        if (humanMessage.speaker !== 'human') continue

        const isLastPair = i === transcriptLength - 1
        const assistantMessage = isLastPair ? assistantMessageInProgress : transcript[i + 1]

        const isLoading =
            assistantMessage &&
            assistantMessage.error === undefined &&
            assistantMessageInProgress &&
            isLastPair

        pairs.push({
            humanMessage: {
                ...humanMessage,
                index: i,
                isUnsentFollowup: false,
                intent: humanMessage.intent ?? null,
            },
            assistantMessage: assistantMessage
                ? { ...assistantMessage, index: i + 1, isLoading: !!isLoading }
                : null,
        })
    }

    const lastMessage = pairs[pairs.length - 1]
    const lastHumanMessage = lastMessage?.humanMessage
    const lastAssistantMessage = lastMessage?.assistantMessage
    const isAborted = isAbortErrorOrSocketHangUp(lastAssistantMessage?.error)
    const shouldAddFollowup =
        lastAssistantMessage &&
        (!lastAssistantMessage.error ||
            (isAborted && lastAssistantMessage.text) ||
            (!assistantMessageInProgress && lastAssistantMessage.text))

    if (!transcript.length || shouldAddFollowup) {
        pairs.push({
            humanMessage: {
                // Always using a fixed index for the last/followup editor ensures it will be reused
                // across renders and not recreated when transcript length changes.
                // This is a hack to avoid the editor getting reset during Agent mode.
                index: lastHumanMessage?.intent === 'agentic' ? -1 : pairs.length * 2,
                speaker: 'human',
                isUnsentFollowup: true,
                intent: lastHumanMessage?.intent === 'agentic' ? 'agentic' : 'chat',
                sourceNodeIds: lastHumanMessage?.sourceNodeIds,
            },
            assistantMessage: null,
        })
    }

    return pairs
}

interface TranscriptInteractionProps extends Omit<TranscriptProps, 'transcript' | 'messageInProgress'> {
    activeChatContext: Context | undefined
    setActiveChatContext: (context: Context | undefined) => void
    interaction: Interaction
    isFirstInteraction: boolean
    isLastInteraction: boolean
    isLastSentInteraction: boolean
    priorAssistantMessageIsLoading: boolean
    editorRef?: React.RefObject<PromptEditorRefAPI | null>
}

export type RegeneratingCodeBlockState = {
    id: string
    code: string
    error: string | undefined
}

const TranscriptInteraction: FC<TranscriptInteractionProps> = memo(props => {
    const {
        interaction: { humanMessage, assistantMessage },
        isFirstInteraction,
        isLastInteraction,
        isLastSentInteraction,
        priorAssistantMessageIsLoading,
        userInfo,
        chatEnabled,
        postMessage,
        insertButtonOnSubmit,
        copyButtonOnSubmit,
        editorRef: parentEditorRef,
        primaryAsset,
        primaryAssetLoaded,
        chatID,
    } = props
    const [sourceNodeIds, setSourceNodeIds] = useState<string[]>([])

    useEffect(() => {
        setSourceNodeIds(humanMessage.sourceNodeIds ?? [])
    }, [humanMessage])

    const humanEditorRef = useRef<PromptEditorRefAPI | null>(null)
    // const lastEditorRef = useContext(LastEditorContext);
    useImperativeHandle(parentEditorRef, () => humanEditorRef.current)

    const [selectedIntent, setSelectedIntent] = useState<ChatMessage['intent']>(humanMessage?.intent)

    // Reset intent to 'chat' when there are no interactions (new chat)
    useEffect(() => {
        if (isFirstInteraction && isLastInteraction && humanMessage.isUnsentFollowup) {
            humanMessage.intent = 'chat'
            setSelectedIntent('chat')
        }
    }, [humanMessage, isFirstInteraction, isLastInteraction])

    const onUserAction = useCallback(
        (action: 'edit' | 'submit', manuallySelectedIntent: ChatMessage['intent']) => {
            // Serialize the editor value after starting the span
            const editorValue = humanEditorRef.current?.getSerializedValue()
            if (!editorValue) {
                console.error('Failed to serialize editor value')
                return
            }

            const commonProps = {
                editorValue,
                manuallySelectedIntent,
                sourceNodeIds,
            }

            if (action === 'edit') {
                // Remove search context chips from the next input so that the user cannot
                // reference search results that don't exist anymore.
                // This is a no-op if the input does not contain any search context chips.
                // NOTE: Doing this for the penultimate input only seems to suffice because
                // editing a message earlier in the transcript will clear the conversation
                // and reset the last input anyway.
                // if (isLastSentInteraction) {
                //   lastEditorRef.current?.filterMentions((item) => !isCodeSearchContextItem(item));
                // }
                editHumanMessage({
                    messageIndexInTranscript: humanMessage.index,
                    ...commonProps,
                })
            } else {
                submitHumanMessage({
                    ...commonProps,
                })
            }
        },
        [humanMessage, sourceNodeIds]
    )

    const vscodeAPI = getVSCodeAPI()
    const onStop = useCallback(() => {
        vscodeAPI.postMessage({
            command: 'abort',
        })
    }, [vscodeAPI])

    // const isSearchIntent = omniboxEnabled && humanMessage.intent === 'search';
    const isSearchIntent = false

    const isContextLoading = Boolean(
        !isSearchIntent &&
            humanMessage.contextFiles === undefined &&
            isLastSentInteraction &&
            assistantMessage?.text === undefined &&
            assistantMessage?.subMessages === undefined
    )

    const [_isLoading, setIsLoading] = useState(assistantMessage?.isLoading)

    const [isThoughtProcessOpened, setThoughtProcessOpened] = useLocalStorage(
        'driver-ai.thinking-space.open',
        true
    )

    useEffect(() => {
        setIsLoading(assistantMessage?.isLoading)
    }, [assistantMessage])

    const humanMessageInfo = useMemo(() => {
        // See SRCH-942: it's critical to memoize this value to avoid repeated
        // requests to our guardrails server.
        if (assistantMessage && !isContextLoading) {
            return makeHumanMessageInfo({ humanMessage, assistantMessage }, humanEditorRef)
        }
        return null
    }, [humanMessage, assistantMessage, isContextLoading])

    const onHumanMessageSubmit = useCallback(
        (intentOnSubmit: ChatMessage['intent']) => {
            // Current intent is the last selected intent if any or the current intent of the human message
            const currentIntent = selectedIntent || humanMessage?.intent
            // If no intent on submit provided, use the current intent instead
            const newIntent = intentOnSubmit === undefined ? currentIntent : intentOnSubmit
            setSelectedIntent(newIntent)
            if (humanMessage.isUnsentFollowup) {
                onUserAction('submit', newIntent)
            } else {
                // Use onUserAction directly with the new intent
                onUserAction('edit', newIntent)
            }
            // Set the unsent followup flag to false after submitting
            // to makes sure the last editor for Agent mode gets reset.
            humanMessage.isUnsentFollowup = false
        },
        [humanMessage, onUserAction, selectedIntent]
    )

    const agentToolCalls = useMemo(() => {
        return assistantMessage?.contextFiles?.filter(f => f.type === 'tool-state')
    }, [assistantMessage?.contextFiles])

    return (
        <>
            {/* Show loading state on the last interaction */}
            {isLastInteraction && priorAssistantMessageIsLoading && <LoadingDots />}
            <HumanMessageCell
                key={humanMessage.index}
                chatEnabled={chatEnabled}
                message={humanMessage}
                isFirstMessage={humanMessage.index === 0}
                isSent={!humanMessage.isUnsentFollowup}
                isPendingPriorResponse={priorAssistantMessageIsLoading}
                onSubmit={onHumanMessageSubmit}
                onStop={onStop}
                isFirstInteraction={isFirstInteraction}
                isLastInteraction={isLastInteraction}
                isEditorInitiallyFocused={isLastInteraction}
                editorRef={humanEditorRef}
                className={!isFirstInteraction && isLastInteraction ? 'tw-mt-auto' : ''}
                intent={selectedIntent}
                manuallySelectIntent={setSelectedIntent}
                primaryAsset={primaryAsset}
                primaryAssetLoaded={primaryAssetLoaded}
                chatID={chatID}
                handleTunerSubmit={setSourceNodeIds}
                sourceNodeIds={sourceNodeIds}
            />

            <>
                {/* {omniboxEnabled && assistantMessage?.didYouMeanQuery && (
            <DidYouMeanNotice
              query={assistantMessage?.didYouMeanQuery}
              disabled={!!assistantMessage?.isLoading}
              switchToSearch={() => {
                editAndSubmitSearch(assistantMessage?.didYouMeanQuery ?? '');
              }}
            />
          )} */}
                {!isSearchIntent && (
                    <AgenticContextCell
                        key={`${humanMessage.index}-${humanMessage.intent}-process`}
                        isContextLoading={isContextLoading}
                        processes={humanMessage?.processes ?? undefined}
                    />
                )}
                {/* {!(humanMessage.agent && isContextLoading) &&
          (humanMessage.contextFiles || assistantMessage || isContextLoading) &&
          !isSearchIntent && (
            <ContextCell
              key={`${humanMessage.index}-${humanMessage.intent}-context`}
              contextItems={humanMessage.contextFiles}
              contextAlternatives={humanMessage.contextAlternatives}
              isForFirstMessage={humanMessage.index === 0}
              isContextLoading={isContextLoading}
              defaultOpen={isContextLoading && humanMessage.agent === DeepDriverAgentID}
            />
          )} */}
            </>

            {assistantMessage &&
                (!isContextLoading ||
                    (assistantMessage.subMessages && assistantMessage.subMessages.length > 0)) && (
                    <AssistantMessageCell
                        key={assistantMessage.index}
                        userInfo={userInfo}
                        chatEnabled={chatEnabled}
                        message={assistantMessage}
                        copyButtonOnSubmit={copyButtonOnSubmit}
                        insertButtonOnSubmit={insertButtonOnSubmit}
                        postMessage={postMessage}
                        humanMessage={humanMessageInfo}
                        isLoading={isLastSentInteraction && assistantMessage.isLoading}
                        isLastSentInteraction={isLastSentInteraction}
                        setThoughtProcessOpened={setThoughtProcessOpened}
                        isThoughtProcessOpened={isThoughtProcessOpened}
                    />
                )}
            {/* Shows tool contents instead of editor if any */}
            {agentToolCalls?.map(tool => (
                <ToolStatusCell
                    key={tool.toolId}
                    title={tool.toolName}
                    output={tool}
                    className="w-full"
                />
            ))}
        </>
    )
}, isEqual)

TranscriptInteraction.displayName = 'TranscriptInteraction'

// TODO(sqs): Do this the React-y way.
export function focusLastHumanMessageEditor(): void {
    const elements = document.querySelectorAll<HTMLElement>('[data-lexical-editor]')
    const lastEditor = elements.item(elements.length - 1)
    if (!lastEditor) {
        return
    }

    lastEditor.focus()

    // Only scroll the nearest scrollable ancestor container, not all scrollable ancestors, to avoid
    // a bug in VS Code where the iframe is pushed up by ~5px.
    const container = lastEditor?.closest('[data-scrollable]')
    const editorScrollItemInContainer = lastEditor.parentElement
    if (container && container instanceof HTMLElement && editorScrollItemInContainer) {
        container.scrollTop = editorScrollItemInContainer.offsetTop - container.offsetTop
    }
}

export function editHumanMessage({
    messageIndexInTranscript,
    editorValue,
    manuallySelectedIntent,
    sourceNodeIds,
}: {
    messageIndexInTranscript: number
    editorValue: SerializedPromptEditorValue
    manuallySelectedIntent?: ChatMessage['intent']
    sourceNodeIds?: string[]
}): void {
    getVSCodeAPI().postMessage({
        command: 'edit',
        index: messageIndexInTranscript,
        text: editorValue.text,
        editorState: editorValue.editorState,
        contextItems: editorValue.contextItems.map(deserializeContextItem),
        manuallySelectedIntent,
        sourceNodeIds,
    })
    focusLastHumanMessageEditor()
}

function submitHumanMessage({
    editorValue,
    manuallySelectedIntent,
    sourceNodeIds,
}: {
    editorValue: SerializedPromptEditorValue
    manuallySelectedIntent?: ChatMessage['intent']
    sourceNodeIds?: string[]
}): void {
    getVSCodeAPI().postMessage({
        command: 'submit',
        text: editorValue.text,
        editorState: editorValue.editorState,
        contextItems: editorValue.contextItems.map(deserializeContextItem),
        manuallySelectedIntent,
        sourceNodeIds,
    })
    focusLastHumanMessageEditor()
}
