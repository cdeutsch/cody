import {
    type AuthCredentials,
    type AuthStatus,
    type ChatMessage,
    type ContextItem,
    type ContextItemOpenCtx,
    ContextItemSource,
    type ContextMessage,
    type DefaultChatCommands,
    type EventSource,
    FeatureFlag,
    PrimaryAsset,
    ProcessType,
    type ProcessingStep,
    PromptString,
    type RankedContext,
    type SerializedChatInteraction,
    type SerializedChatTranscript,
    type SerializedPromptEditorState,
    addMessageListenersForExtensionAPI,
    authStatus,
    clientCapabilities,
    createMessageAPIForExtension,
    currentAuthStatus,
    currentAuthStatusAuthed,
    currentResolvedConfig,
    featureFlagProvider,
    forceHydration,
    getAuthHeadersForCurrentConfig,
    getBaseApiUrl,
    getContextForChatMessage,
    getPrimaryAsset,
    getPrimaryAssetByRepoName,
    getRepoList,
    getTree,
    hydrateAfterPostMessage,
    inputTextWithoutContextChipsFromPromptEditorState,
    isAbortErrorOrSocketHangUp,
    isAuthError,
    isDefined,
    isError,
    logError,
    promiseFactoryToObservable,
    reformatBotMessageForChat,
    resolvedConfig,
    sanitizeMessages,
    serializeChatMessage,
    shareReplay,
    skipPendingOperation,
    subscriptionDisposable,
    switchMap,
    wrapInActiveSpan,
} from '@sourcegraph/cody-shared'
import * as uuid from 'uuid'
import * as vscode from 'vscode'

import type { Span } from '@opentelemetry/api'
import { ChatHistoryType } from '@sourcegraph/cody-shared/src/chat/transcript'
import { resolveAuth } from '@sourcegraph/cody-shared/src/configuration/auth-resolver'
import { map } from 'observable-fns'
import type { URI } from 'vscode-uri'
import { View } from '../../../webviews/tabs/types'
import { signOut } from '../../auth/auth'
import {
    closeAuthProgressIndicator,
    startAuthProgressIndicator,
} from '../../auth/auth-progress-indicator'
import { resolveContextItems } from '../../editor/utils/editor-context'
import type { VSCodeEditor } from '../../editor/vscode-editor'
import type { ExtensionClient } from '../../extension-client'
import { getGitRepositoryName } from '../../git-utils'
import { logDebug } from '../../output-channel-logger'
import { getCategorizedMentions } from '../../prompt-builder/utils'
import { hydratePromptText } from '../../prompts/prompt-hydration'
import { authProvider } from '../../services/AuthProvider'
import { AuthProviderSimplified } from '../../services/AuthProviderSimplified'
import { secretStorage } from '../../services/SecretStorageProvider'
import { openExternalLinks } from '../../services/utils/workspace-action'
import type { MessageErrorType } from '../MessageProvider'
import { getMentionMenuData } from '../context/chatContext'
import { observeDefaultContext } from '../initialContext'
import type {
    ConfigurationSubsetForWebview,
    ExtensionMessage,
    LocalEnv,
    WebviewMessage,
} from '../protocol'
import { ChatBuilder, prepareChatMessage } from './ChatBuilder'
import { chatHistory } from './ChatHistoryManager'
import { type ContextRetriever, toStructuredMentions } from './ContextRetriever'
import { InitDoer } from './InitDoer'
import type { HumanInput } from './context'
import { DefaultPrompter } from './prompt'

export const ChatEditorViewType = 'driver-ai.editorPanel'
export const ChatSidebarViewType = 'driver-ai.chat'

export interface ChatControllerOptions {
    extensionUri: vscode.Uri
    contextRetriever: Pick<ContextRetriever, 'retrieveContext'>
    editor: VSCodeEditor
    extensionClient: Pick<ExtensionClient, 'capabilities'>
}

export interface ChatSession {
    webviewPanelOrView: vscode.WebviewView | vscode.WebviewPanel | undefined
    sessionID: string
}

/**
 * ChatController is the view controller class for the chat panel.
 * It handles all events sent from the view, keeps track of the underlying chat model,
 * and interacts with the rest of the extension.
 *
 * Its methods are grouped into the following sections, each of which is demarcated
 * by a comment block (search for "// #region "):
 *
 * 1. top-level view action handlers
 * 2. view updaters
 * 3. chat request lifecycle methods
 * 4. session management
 * 5. webview container management
 * 6. other public accessors and mutators
 *
 * The following invariants should be maintained:
 * 1. top-level view action handlers
 *    a. should all follow the handle$ACTION naming convention
 *    b. should be private (with the existing exceptions)
 * 2. view updaters
 *    a. should all follow the post$ACTION naming convention
 *    b. should NOT mutate model state
 * 3. Keep the public interface of this class small in order to
 *    avoid tight coupling with other classes. If communication
 *    with other components outside the model and view is needed,
 *    use a broadcast/subscription design.
 */
export class ChatController implements vscode.Disposable, vscode.WebviewViewProvider, ChatSession {
    private chatBuilder: ChatBuilder

    private primaryAssetId: string | undefined
    private repoName: string | undefined

    private readonly contextRetriever: ChatControllerOptions['contextRetriever']

    private readonly editor: ChatControllerOptions['editor']
    private readonly extensionClient: ChatControllerOptions['extensionClient']

    private disposables: vscode.Disposable[] = []

    public dispose(): void {
        vscode.Disposable.from(...this.disposables).dispose()
        this.disposables = []
    }

    constructor({ extensionUri, editor, contextRetriever, extensionClient }: ChatControllerOptions) {
        this.extensionUri = extensionUri
        this.editor = editor
        this.extensionClient = extensionClient
        this.contextRetriever = contextRetriever

        this.chatBuilder = new ChatBuilder(undefined)

        this.disposables.push(
            subscriptionDisposable(
                authStatus.subscribe(authStatus => {
                    // Run this async because this method may be called during initialization
                    // and awaiting on this.postMessage may result in a deadlock
                    void this.sendConfig(authStatus)
                })
            )
        )
    }

    private async getPrimaryAssetId(): Promise<string | undefined> {
        try {
            this.repoName = await getGitRepositoryName()

            const primaryAsset = await getPrimaryAssetByRepoName(this.repoName)

            return primaryAsset?.id
        } catch (error) {
            logError('ChatController: getPrimaryAssetId', 'Error getting primary asset id', error)
            if (!isAuthError(error)) {
                const errorMessage = 'Failed to check if Driver contains this repository.'
                void vscode.window.showErrorMessage(errorMessage)
                this.postError(new Error(errorMessage))
            }
            return undefined
        }
    }

    private async syncPrimaryAssetId(): Promise<void> {
        this.primaryAssetId = await this.getPrimaryAssetId()
        this.chatBuilder.setPrimaryAssetId(this.primaryAssetId)
        await this.postViewTranscript()
    }

    /**
     * onDidReceiveMessage handles all user actions sent from the chat panel view.
     * @param message is the message from the view.
     */
    private async onDidReceiveMessage(message: WebviewMessage): Promise<void> {
        switch (message.command) {
            case 'ready':
                await this.syncPrimaryAssetId()
                await this.handleReady()
                break
            case 'initialized':
                await this.handleInitialized()
                this.setWebviewToChat()
                break
            case 'submit': {
                await this.handleUserMessage({
                    requestID: uuid.v4(),
                    inputText: PromptString.unsafe_fromUserQuery(message.text),
                    mentions: message.contextItems ?? [],
                    editorState: message.editorState as SerializedPromptEditorState,
                    signal: this.startNewSubmitOrEditOperation(),
                    source: 'chat',
                    manuallySelectedIntent: message.manuallySelectedIntent,
                    sourceNodeIds: message.sourceNodeIds,
                })
                break
            }
            case 'edit': {
                this.cancelSubmitOrEditOperation()

                await this.handleEdit({
                    requestID: uuid.v4(),
                    text: PromptString.unsafe_fromUserQuery(message.text),
                    index: message.index ?? undefined,
                    contextFiles: message.contextItems ?? [],
                    editorState: message.editorState as SerializedPromptEditorState,
                    manuallySelectedIntent: message.manuallySelectedIntent,
                    sourceNodeIds: message.sourceNodeIds,
                })
                break
            }
            case 'abort':
                this.handleAbort()
                break
            case 'openURI':
                vscode.commands.executeCommand('vscode.open', message.uri, {
                    selection: message.range,
                })
                break
            case 'links': {
                void openExternalLinks(message.value)
                break
            }
            case 'openFileLink':
                {
                    // if (message?.uri?.scheme?.startsWith('http')) {
                    //     this.openRemoteFile(message.uri, true)
                    //     return
                    // }

                    // Determine if we're in the sidebar view
                    const isInSidebar =
                        this._webviewPanelOrView && !('viewColumn' in this._webviewPanelOrView)

                    vscode.commands.executeCommand('vscode.open', message.uri, {
                        selection: message.range,
                        preserveFocus: true,
                        background: false,
                        preview: true,
                        // Use the active column if in sidebar, otherwise use Beside
                        viewColumn: isInSidebar ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside,
                    })
                }
                break
            case 'show-page':
                await vscode.commands.executeCommand('cody.show-page', message.page)
                break
            case 'restoreHistory':
                this.restoreSession(message.chatID)
                this.setWebviewToChat()
                break
            case 'chatSession':
                switch (message.action) {
                    case 'new':
                        await this.clearAndRestartSession()
                        break
                    case 'duplicate':
                        await this.duplicateSession(message.sessionID ?? this.chatBuilder.sessionID)
                        break
                }
                break
            case 'command':
                vscode.commands.executeCommand(message.id, message.arg ?? message.args)
                break

            case 'auth':
                if (message.authKind === 'refresh') {
                    authProvider.refresh()
                    break
                }
                if (message.authKind === 'simplified-onboarding') {
                    closeAuthProgressIndicator()
                    startAuthProgressIndicator()

                    const authProviderSimplified = new AuthProviderSimplified()
                    const successfullyOpenedUrl = await authProviderSimplified.openExternalAuthUrl()
                    if (!successfullyOpenedUrl) {
                        closeAuthProgressIndicator()
                    }

                    // const response = await authManager.login();
                    // closeAuthProgressIndicator();
                    // if (response) {
                    //   const credentials: AuthCredentials = {
                    //     credentials: { token: response.access_token, source: 'redirect' },
                    //   };
                    //   const authStatus = await authProvider.validateAndStoreCredentials(credentials, 'store-if-valid');
                    //   if (!authStatus.authenticated) {
                    //     void vscode.window.showErrorMessage('Authentication failed. Please check your token and try again.');
                    //   } else {
                    //     await this.syncPrimaryAssetId();
                    //     await this.syncChatBuilderPrimaryAsset(this.primaryAssetId);
                    //   }
                    // } else {
                    //   void vscode.window.showErrorMessage('Authentication failed. Login did not complete.');
                    // }
                }
                if (message.authKind === 'signin' || message.authKind === 'callback') {
                    // 🐉🐉🐉
                    // THIS IS UNTESTED AND WAS UNUSED IN THE PAST
                    try {
                        const { value: token } = message
                        let auth: AuthCredentials | undefined = undefined

                        if (token) {
                            auth = {
                                credentials: { token, source: 'paste' },
                            }
                        } else {
                            const { configuration } = await currentResolvedConfig()
                            auth = await resolveAuth(configuration, secretStorage)
                        }

                        // if (!auth || !auth.credentials) {
                        //   return redirectToEndpointLogin(endpoint);
                        // }

                        await authProvider.validateAndStoreCredentials(auth, 'always-store')
                    } catch (error) {
                        void vscode.window.showErrorMessage(`Authentication failed: ${error}`)
                        this.postError(new Error(`Authentication failed: ${error}`))
                    }
                    break
                }
                if (message.authKind === 'signout') {
                    await signOut()

                    // Send config to refresh the endpoint history list.
                    // TODO: Remove this when the config for webview is observable, see getConfigForWebview.
                    await this.sendConfig(currentAuthStatus())
                    break
                }
                break

            case 'log': {
                const logger = message.level === 'debug' ? logDebug : logError
                logger(message.filterLabel, message.message)
                break
            }
        }
    }

    private async getConfigForWebview(): Promise<ConfigurationSubsetForWebview & LocalEnv> {
        const isEditorViewType = this.webviewPanelOrView?.viewType === ChatEditorViewType
        const webviewType = isEditorViewType ? 'editor' : 'sidebar'
        const uiKindIsWeb = vscode.env.uiKind === vscode.UIKind.Web

        return {
            uiKindIsWeb,
            webviewType,
            multipleWebviewsEnabled: true,
        }
    }

    // =======================================================================
    // #region top-level view action handlers
    // =======================================================================

    // When the webview sends the 'ready' message, respond by posting the view config
    private async handleReady(): Promise<void> {
        await this.syncChatBuilderPrimaryAsset(this.primaryAssetId)

        await this.sendConfig(currentAuthStatus())
    }

    private async sendConfig(authStatus: AuthStatus): Promise<void> {
        // Don't emit config if we're verifying auth status to avoid UI auth flashes on the client
        if (authStatus.pendingValidation) {
            return
        }

        const configForWebview = await this.getConfigForWebview()
        const workspaceFolderUris =
            vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? []

        await this.postMessage({
            type: 'config',
            config: configForWebview,
            clientCapabilities: clientCapabilities(),
            authStatus: authStatus,
            workspaceFolderUris,
        })
        logDebug('ChatController', 'updateViewConfig', {
            verbose: configForWebview,
        })
    }

    private initDoer = new InitDoer<boolean | undefined>()
    private async handleInitialized(): Promise<void> {
        // HACK: this call is necessary to get the webview to set the chatID state,
        // which is necessary on deserialization. It should be invoked before the
        // other initializers run (otherwise, it might interfere with other view
        // state)
        await this.webviewPanelOrView?.webview.postMessage({
            type: 'transcript',
            messages: [],
            isMessageInProgress: false,
        })

        void this.saveSession()
        this.initDoer.signalInitialized()
    }

    /**
     * Handles user input text for both new and edit submissions
     */
    public async handleUserMessage({
        requestID,
        inputText,
        mentions,
        editorState,
        signal,
        source,
        command,
        manuallySelectedIntent,
        sourceNodeIds,
    }: {
        requestID: string
        inputText: PromptString
        mentions: ContextItem[]
        editorState: SerializedPromptEditorState | null
        signal: AbortSignal
        source?: EventSource
        command?: DefaultChatCommands
        manuallySelectedIntent?: ChatMessage['intent'] | undefined | null
        traceparent?: string | undefined | null
        sourceNodeIds?: string[] | undefined | null
    }): Promise<void> {
        this.chatBuilder.addHumanMessage({
            text: inputText,
            editorState,
            intent: manuallySelectedIntent,
            sourceNodeIds,
        })

        this.setCustomChatTitle(requestID, inputText, signal)
        this.postViewTranscript({ speaker: 'assistant' })

        await this.saveSession()
        signal.throwIfAborted()

        return this.sendChat({
            requestID,
            inputText,
            mentions,
            editorState,
            signal,
            source,
            command,
            manuallySelectedIntent,
            sourceNodeIds,
        })
    }

    private async sendChat({
        requestID,
        inputText,
        mentions,
        editorState,
        signal,
        source,
        command,
        manuallySelectedIntent,
        sourceNodeIds,
    }: Parameters<typeof this.handleUserMessage>[0]): Promise<void> {
        try {
            signal.throwIfAborted()

            this.postEmptyMessageInProgress()

            // this.setFrequentlyUsedContextItemsToStorage(mentions)

            this.postEmptyMessageInProgress()

            // const repoName = await getGitRepositoryName();

            // let resolvedRefs: string[] = mentions.map((mention) => mention.uri.fsPath);

            // // Default to the entire codebase if no references are provided.
            // if (resolvedRefs.length === 0) {
            //   resolvedRefs = [repoName + '/'];
            // }

            // The following is pieced together from the Driver `sendChat` pipeline.
            // The goal is to send the extra context from the sigils to the LLM.

            const actualMentions = mentions.map(m =>
                m.source ? m : { ...m, source: ContextItemSource.User }
            )

            const contextResult = await computeContext(
                requestID,
                { text: inputText, mentions: actualMentions },
                editorState,
                this.editor,
                this.contextRetriever,
                signal
            )

            if (contextResult.error) {
                this.postError(contextResult.error, 'transcript')
            }
            if (contextResult.abort) {
                throw new Error('aborted')
            }
            const corpusContext = contextResult.contextItems ?? []
            signal.throwIfAborted()

            const { explicitMentions, implicitMentions } = getCategorizedMentions(corpusContext)
            const prompter = new DefaultPrompter(explicitMentions, implicitMentions)

            const { prompt } = await prompter.makePrompt(this.chatBuilder)

            const actualMessages = sanitizeMessages(prompt)

            // Get all human messages that contain file or symbol context and concatenate them
            const extraContext = actualMessages
                .filter((msg): msg is ContextMessage => {
                    if (msg.speaker !== 'human' || !('file' in msg)) {
                        return false
                    }
                    const file = msg.file as { type?: string }
                    return file.type === 'file' || file.type === 'symbol'
                })
                .map(msg => msg.text?.toString() ?? '')
                .join('\n\n')

            const pdfRootNodeIds = actualMentions.filter(m => m.type === 'pdf').map(m => m.rootNodeId)

            let actualSourceNodeIds = [...(sourceNodeIds || []), ...pdfRootNodeIds]

            if (actualSourceNodeIds.length === 0) {
                const rootNodeId = this.chatBuilder.getPrimaryAsset()?.most_recent_version?.root_node.id
                if (rootNodeId) {
                    actualSourceNodeIds = [rootNodeId]
                }
            }

            const headers = await getAuthHeadersForCurrentConfig()

            const response = await fetch(`${getBaseApiUrl()}/tmp/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    user_prompt: `${inputText.toString()}\n\n${extraContext}`,
                    llm_session_id: this.llmSessionId,
                    source_node_ids: actualSourceNodeIds,
                }),
                signal,
            })
            const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()

            if (response.status !== 200) {
                if (response.status === 401) {
                    const { configuration } = await currentResolvedConfig()
                    const auth = await resolveAuth(configuration, secretStorage)
                    await authProvider.validateAndStoreCredentials(auth, 'always-store')
                }

                let error = ''
                while (reader && true) {
                    const { value, done } = await reader.read()

                    if (done) {
                        break
                    }
                    error += value
                }
                this.postError(new Error(`HTTP ${response.status} - ${error}`))

                return
            }

            let contentInProgress = ''
            let isFinished = false
            const steps: ProcessingStep[] = []
            let buffer = '' // Buffer to accumulate partial messages

            const processMessage = (data: any) => {
                switch (data.kind) {
                    case 'START_SESSION':
                        this.chatBuilder.llmSessionId = data.llm_session_id
                        void this.saveSession()
                        break
                    case 'TOOL_STATUS_UPDATE':
                        steps.push({
                            type: ProcessType.Tool,
                            id: steps.length.toString(),
                            content: data.content,
                            state: 'pending',
                        })
                        this.chatBuilder.setLastMessageProcesses(steps)
                        this.postViewTranscript({
                            text: PromptString.unsafe_fromLLMResponse(contentInProgress),
                            speaker: 'assistant',
                        })
                        break
                    case 'REFERENCES':
                        // TODO: Add support for references.
                        console.log('TODO: references', data)
                        break
                    case 'RESPONSE_CHUNK':
                        contentInProgress += data.content
                        this.postViewTranscript({
                            text: PromptString.unsafe_fromLLMResponse(contentInProgress),
                            speaker: 'assistant',
                        })
                        break
                    case 'END_SESSION':
                    case 'RESPONSE_FULL':
                        if (!isFinished) {
                            this.addBotMessage(
                                requestID,
                                PromptString.unsafe_fromLLMResponse(data.content)
                            )
                            this.postViewTranscript()
                        }
                        isFinished = true
                        break
                    case 'ERROR':
                        this.postError(new Error(data.error), 'transcript')
                        isFinished = true
                        break
                    default:
                        this.postViewTranscript({
                            text: PromptString.unsafe_fromLLMResponse(`Unknown message kind: ${data}`),
                            speaker: 'assistant',
                        })
                        logError('ChatController:processMessage', 'Unknown message kind:', data)
                        break
                }
            }

            while (reader && true) {
                const { value, done } = await reader.read()

                if (done) {
                    break
                }

                // Add new data to buffer
                buffer += value

                // Process complete messages from buffer
                let newlineIndex: number
                // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex)
                    buffer = buffer.slice(newlineIndex + 1)

                    if (!line.trim()) {
                        continue // Skip empty lines
                    }

                    // Remove the data: prefix and trim
                    const token = line.trim().substring(6)

                    try {
                        const data = JSON.parse(token)
                        processMessage(data)
                    } catch (error) {
                        // Only log error if we have a complete line (ends with newline)
                        if (line.endsWith('\n')) {
                            logError('ChatController:processMessage', 'Error parsing JSON:', error)
                            logDebug(
                                'ChatController:processMessage',
                                'JSON with Error Token:',
                                "'",
                                token,
                                "'"
                            )
                            logDebug(
                                'ChatController:processMessage',
                                'JSON with Error Value:',
                                "'",
                                value,
                                "'"
                            )
                            logDebug(
                                'ChatController:processMessage',
                                'JSON with Error Line:',
                                "'",
                                line,
                                "'"
                            )
                            logDebug(
                                'ChatController:processMessage',
                                'JSON with Error Buffer:',
                                "'",
                                buffer,
                                "'"
                            )
                        }
                        // If we have an error and the line doesn't end with newline,
                        // it might be a partial message, so we keep it in the buffer
                    }
                }
            }

            // Process any remaining data in buffer after stream ends
            if (buffer.trim()) {
                try {
                    const token = buffer.trim().substring(6)
                    const data = JSON.parse(token)
                    processMessage(data)
                } catch (error) {
                    logError('ChatController:processMessage', 'Error parsing final JSON:', error)
                    logDebug('ChatController:processMessage', 'Final buffer:', buffer)
                }
            }
        } catch (error) {
            logError('ChatController:sendChat', 'Driver AI Chat error:', error)

            if (isAbortErrorOrSocketHangUp(error as Error)) {
                this.postViewTranscript()
                return
                // biome-ignore lint/style/noUselessElse: <explanation>
            } else {
                this.postError(
                    isError(error) ? error : new Error(`Error generating assistant response: ${error}`)
                )
            }
        }
    }

    // private async setFrequentlyUsedContextItemsToStorage(mentions: ContextItem[]) {
    //     const authStatus = currentAuthStatus()
    //     const activeEditor = getEditor().active

    //     const repoName = activeEditor?.document.uri
    //         ? (
    //               await firstResultFromOperation(
    //                   repoNameResolver.getRepoNamesContainingUri(activeEditor.document.uri)
    //               )
    //           ).at(0)
    //         : null

    //     if (authStatus.authenticated) {
    //         saveFrequentlyUsedContextItems({
    //             items: mentions
    //                 .filter(item => item.source === ContextItemSource.User)
    //                 .map(item => serializeContextItem(item)),
    //             authStatus,
    //             codebases: repoName ? [repoName] : [],
    //         })
    //     }
    // }
    // private async getFrequentlyUsedContextItemsFromStorage() {
    //     const authStatus = currentAuthStatus()
    //     const activeEditor = getEditor().active

    //     const repoName = activeEditor?.document.uri
    //         ? (
    //               await firstResultFromOperation(
    //                   repoNameResolver.getRepoNamesContainingUri(activeEditor.document.uri)
    //               )
    //           ).at(0)
    //         : null

    //     if (authStatus.authenticated) {
    //         return getFrequentlyUsedContextItems({
    //             authStatus,
    //             codebases: repoName ? [repoName] : [],
    //         })
    //     }

    //     return []
    // }

    private submitOrEditOperation: AbortController | undefined
    public startNewSubmitOrEditOperation(): AbortSignal {
        this.submitOrEditOperation?.abort()
        this.submitOrEditOperation = new AbortController()
        return this.submitOrEditOperation.signal
    }

    private cancelSubmitOrEditOperation(): void {
        this.submitOrEditOperation?.abort()
        this.submitOrEditOperation = undefined
    }

    /**
     * Handles editing a human chat message in current chat session.
     *
     * Removes any existing messages from the provided index,
     * before submitting the replacement text as a new question.
     * When no index is provided, default to the last human message.
     *
     * @internal Public for testing only.
     */
    public async handleEdit({
        requestID,
        text,
        index,
        contextFiles,
        editorState,
        manuallySelectedIntent,
        sourceNodeIds,
    }: {
        requestID: string
        text: PromptString
        index: number | undefined
        contextFiles: ContextItem[]
        editorState: SerializedPromptEditorState | null
        manuallySelectedIntent?: ChatMessage['intent']
        sourceNodeIds?: string[] | undefined | null
    }): Promise<void> {
        const abortSignal = this.startNewSubmitOrEditOperation()

        try {
            const humanMessage = index ?? this.chatBuilder.getLastSpeakerMessageIndex('human')
            if (humanMessage === undefined) {
                return
            }
            this.chatBuilder.removeMessagesFromIndex(humanMessage, 'human')
            return await this.handleUserMessage({
                requestID,
                inputText: text,
                mentions: contextFiles,
                editorState,
                signal: abortSignal,
                source: 'chat',
                manuallySelectedIntent,
                sourceNodeIds,
            })
        } catch (error) {
            if (isAbortErrorOrSocketHangUp(error)) {
                return
            }
            this.postError(new Error('Failed to edit prompt'), 'transcript')
        }
    }

    private handleAbort(): void {
        this.cancelSubmitOrEditOperation()
        // Notify the webview there is no message in progress.
        this.postViewTranscript()
    }

    public async addContextItemsToLastHumanInput(
        contextItems: ContextItem[]
    ): Promise<boolean | undefined> {
        return this.postMessage({
            type: 'clientAction',
            addContextItemsToLastHumanInput: contextItems,
        })
    }

    public async handleGetUserEditorContext(uri?: URI): Promise<void> {
        // Reveal the webview panel if it is hidden
        if (this._webviewPanelOrView) {
            revealWebviewViewOrPanel(this._webviewPanelOrView)
        }
    }

    // #endregion
    // =======================================================================
    // #region view updaters
    // =======================================================================

    private postEmptyMessageInProgress(): void {
        this.postViewTranscript({ speaker: 'assistant' })
    }

    private postViewTranscript(messageInProgress?: ChatMessage): void {
        const messages: ChatMessage[] = [...this.chatBuilder.getMessages()]
        if (messageInProgress) {
            messages.push(messageInProgress)
        }

        // We never await on postMessage, because it can sometimes hang indefinitely:
        // https://github.com/microsoft/vscode/issues/159431
        void this.postMessage({
            type: 'transcript',
            messages: messages.map(prepareChatMessage).map(serializeChatMessage),
            isMessageInProgress: !!messageInProgress,
            chatID: this.chatBuilder.sessionID,
            primaryAsset: this.chatBuilder.getPrimaryAsset(),
            primaryAssetLoaded: this.chatBuilder.getPrimaryAssetLoaded(),
        })

        this.syncPanelTitle()
    }

    private syncPanelTitle() {
        // Update webview panel title if we're in an editor panel
        if (this._webviewPanelOrView && 'reveal' in this._webviewPanelOrView) {
            this._webviewPanelOrView.title = this.chatBuilder.getChatTitle()
        }
    }

    /**
     * Sets the custom chat title based on the first message in the interaction.
     */
    private async setCustomChatTitle(
        requestID: string,
        inputText: PromptString,
        signal: AbortSignal
    ): Promise<void> {
        // Truncate the chat title to 40 characters and add ellipsis if it's longer.
        const truncatedTitle = inputText.toString().slice(0, 40)
        this.chatBuilder.setChatTitle(truncatedTitle.length > 40 ? `${truncatedTitle}…` : truncatedTitle)

        // FUTURE: send the prompt to the LLM to generate a title with about 10 words.
        // See Cody's implementation.
    }

    /**
     * Display error message in webview as part of the chat transcript, or as a system banner alongside the chat.
     */
    private postError(error: Error, type?: MessageErrorType): void {
        // if (isRateLimitError(error)) {
        //   handleRateLimitError(error as RateLimitError);
        // }

        logDebug('ChatController: postError', error.message)
        // Add error to transcript
        if (type === 'transcript') {
            this.chatBuilder.addErrorAsBotMessage(error)
            this.postViewTranscript()
            return
        }

        void this.postMessage({ type: 'errors', errors: error.message })
        // captureException(error);
    }

    /**
     * Low-level utility to post a message to the webview, pending initialization.
     *
     * driver-invariant: this.webview.postMessage should never be invoked directly
     * except within this method.
     */
    private postMessage(message: ExtensionMessage): Thenable<boolean | undefined> {
        return this.initDoer.do(() =>
            this.webviewPanelOrView?.webview.postMessage(forceHydration(message))
        )
    }

    // #endregion
    // =======================================================================
    // #region chat request lifecycle methods
    // =======================================================================

    /**
     * Finalizes adding a bot message to the chat model and triggers an update to the view.
     */
    private async addBotMessage(
        requestID: string,
        rawResponse: PromptString,
        didYouMeanQuery?: string | undefined | null
    ): Promise<void> {
        const messageText = reformatBotMessageForChat(rawResponse)
        this.chatBuilder.addBotMessage({ text: messageText, didYouMeanQuery })
        void this.saveSession()
        this.postViewTranscript()
    }

    // #endregion
    // =======================================================================
    // #region session management
    // =======================================================================

    // A unique identifier for this ChatController instance used to identify
    // it when a handle to this specific panel provider is needed.
    public get sessionID(): string {
        return this.chatBuilder.sessionID
    }

    // Driver LLM Session ID.
    public get llmSessionId(): string | undefined {
        return this.chatBuilder.llmSessionId
    }

    // Attempts to restore the chat to the given sessionID, if it exists in
    // history. If it does, then saves the current session and cancels the
    // current in-progress completion. If the chat does not exist, then this
    // is a no-op.
    public restoreSession(sessionID: string): void {
        const authStatus = currentAuthStatus()
        if (!authStatus.authenticated) {
            return
        }
        const oldTranscript = chatHistory.getChat(authStatus, sessionID)
        if (!oldTranscript) {
            return
        }
        this.cancelSubmitOrEditOperation()
        const newModel = newChatModelFromSerializedChatTranscript(oldTranscript, undefined)
        this.chatBuilder = newModel

        this.syncChatBuilderPrimaryAsset(this.chatBuilder.primaryAssetId)
    }

    /**
     * This method will serialize the chat state synchronously and then save the serialized state to
     * local storage. Usually, it can safely be called without `await`ing.
     * This method should only be awaited if the caller wants to wait for the saved data to be synced
     * to local storage before proceeding.
     */
    private async saveSession(): Promise<void> {
        try {
            const authStatus = currentAuthStatus()
            // Only try to save if authenticated because otherwise we wouldn't be showing a chat.
            const chat = this.chatBuilder.toSerializedChatTranscript()
            if (chat && authStatus.authenticated) {
                await chatHistory.saveChat(authStatus, chat)
            }
        } catch (error) {
            logDebug('ChatController', 'Failed')
        }
    }

    private async duplicateSession(sessionID: string): Promise<void> {
        this.cancelSubmitOrEditOperation()
        const transcript = chatHistory.getChat(currentAuthStatusAuthed(), sessionID)
        if (!transcript) {
            return
        }
        // Assign a new session ID to the duplicated session
        this.chatBuilder = newChatModelFromSerializedChatTranscript(
            transcript,
            new Date(Date.now()).toUTCString()
        )
        this.syncChatBuilderPrimaryAsset(this.chatBuilder.primaryAssetId)
        // Move the new session to the editor
        await vscode.commands.executeCommand('driver-ai.chat.moveToEditor')
        // Restore the old session in the current window
        this.restoreSession(sessionID)
    }

    public async clearAndRestartSession(chatMessages?: ChatMessage[]): Promise<void> {
        this.cancelSubmitOrEditOperation()

        // // Only clear the session if session is not empty.
        // if (!this.chatBuilder?.isEmpty()) {
        const primaryAssetId = await this.getPrimaryAssetId()

        this.chatBuilder = new ChatBuilder(
            this.chatBuilder.selectedModel,
            undefined,
            undefined,
            primaryAssetId,
            chatMessages
        )
        this.syncChatBuilderPrimaryAsset(primaryAssetId)
        // }
    }

    // #endregion
    // =======================================================================
    // #region webview container management
    // =======================================================================

    private extensionUri: vscode.Uri
    private _webviewPanelOrView?: vscode.WebviewView | vscode.WebviewPanel
    public get webviewPanelOrView(): vscode.WebviewView | vscode.WebviewPanel | undefined {
        return this._webviewPanelOrView
    }

    /**
     * Creates the webview view or panel for the Driver chat interface if it doesn't already exist.
     */
    public async createWebviewViewOrPanel(
        activePanelViewColumn?: vscode.ViewColumn,
        lastQuestion?: string
    ): Promise<vscode.WebviewView | vscode.WebviewPanel> {
        // Checks if the webview view or panel already exists and is visible.
        // If so, returns early to avoid creating a duplicate.
        if (this.webviewPanelOrView) {
            return this.webviewPanelOrView
        }

        const viewType = ChatEditorViewType
        const panelTitle = 'Chat'
        const viewColumn = activePanelViewColumn || vscode.ViewColumn.Beside
        const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webviews')
        const panel = vscode.window.createWebviewPanel(
            viewType,
            panelTitle,
            { viewColumn, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true,
                localResourceRoots: [webviewPath],
                enableCommandUris: true,
            }
        )

        return this.registerWebviewPanel(panel)
    }

    /**
     * Revives the chat panel when the extension is reactivated.
     */
    public async revive(webviewPanel: vscode.WebviewPanel): Promise<void> {
        logDebug('ChatController:revive', 'registering webview panel')
        await this.registerWebviewPanel(webviewPanel)
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ): Promise<void> {
        await this.resolveWebviewViewOrPanel(webviewView)
    }

    /**
     * Registers the given webview panel by setting up its options, icon, and handlers.
     * Also stores the panel reference and disposes it when closed.
     */
    private async registerWebviewPanel(panel: vscode.WebviewPanel): Promise<vscode.WebviewPanel> {
        panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'active-chat-icon.svg')
        return this.resolveWebviewViewOrPanel(panel)
    }

    private async resolveWebviewViewOrPanel<T extends vscode.WebviewView | vscode.WebviewPanel>(
        viewOrPanel: T
    ): Promise<T> {
        this._webviewPanelOrView = viewOrPanel
        // this.syncPanelTitle();

        const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webviews')
        viewOrPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [webviewPath],
            enableCommandUris: true,
        }

        await addWebviewViewHTML(this.extensionUri, viewOrPanel)

        // Dispose panel when the panel is closed
        viewOrPanel.onDidDispose(() => {
            this.cancelSubmitOrEditOperation()
            this._webviewPanelOrView = undefined
        })

        this.disposables.push(
            viewOrPanel.webview.onDidReceiveMessage(message =>
                this.onDidReceiveMessage(
                    hydrateAfterPostMessage(message, uri => vscode.Uri.from(uri as any))
                )
            )
        )

        // Listen for API calls from the webview.
        const defaultContext = observeDefaultContext({
            chatBuilder: this.chatBuilder.changes,
        }).pipe(shareReplay())

        this.disposables.push(
            addMessageListenersForExtensionAPI(
                createMessageAPIForExtension({
                    postMessage: this.postMessage.bind(this),
                    postError: this.postError.bind(this),
                    onMessage: callback => {
                        const disposable = viewOrPanel.webview.onDidReceiveMessage(callback)
                        return () => disposable.dispose()
                    },
                }),
                {
                    mentionMenuData: query => {
                        return featureFlagProvider
                            .evaluatedFeatureFlag(FeatureFlag.DriverExperimentalPromptEditor)
                            .pipe(
                                switchMap((experimentalPromptEditor: boolean) =>
                                    getMentionMenuData({
                                        disableProviders:
                                            this.extensionClient.capabilities
                                                ?.disabledMentionsProviders || [],
                                        query: query,
                                        chatBuilder: this.chatBuilder,
                                        experimentalPromptEditor,
                                    })
                                )
                            )
                    },
                    evaluatedFeatureFlag: flag => featureFlagProvider.evaluatedFeatureFlag(flag),
                    hydratePromptMessage: (promptText, initialContext) =>
                        promiseFactoryToObservable(() =>
                            hydratePromptText(promptText, initialContext ?? [])
                        ),
                    repos: input =>
                        promiseFactoryToObservable(async () => {
                            const response = await getRepoList(input)

                            return isError(response) ? [] : response.repositories.nodes
                        }),
                    getTree: input =>
                        promiseFactoryToObservable(async () => {
                            try {
                                const tree = await getTree(input)

                                return tree ?? []
                            } catch (error) {
                                logError('ChatController: getTree', 'Error getting tree:', error)
                                return []
                            }
                        }),
                    defaultContext: () => defaultContext.pipe(skipPendingOperation()),
                    resolvedConfig: () => resolvedConfig,
                    authStatus: () => authStatus,
                    transcript: () =>
                        this.chatBuilder.changes.pipe(map(chat => chat.getDehydratedMessages())),
                    userHistory: (type: ChatHistoryType) => {
                        return type === ChatHistoryType.Full
                            ? chatHistory.changes
                            : chatHistory.lightweightChanges
                    },
                }
            )
        )

        return viewOrPanel
    }

    private async setWebviewToChat(): Promise<void> {
        const viewOrPanel = this._webviewPanelOrView ?? (await this.createWebviewViewOrPanel())
        this._webviewPanelOrView = viewOrPanel
        revealWebviewViewOrPanel(viewOrPanel)
        await this.postMessage({
            type: 'view',
            view: View.Chat,
        })
    }

    // #endregion
    // =======================================================================
    // #region other public accessors and mutators
    // =======================================================================

    // Convenience function for tests
    public getViewTranscript(): readonly ChatMessage[] {
        return this.chatBuilder.getMessages().map(prepareChatMessage)
    }

    public isEmpty(): boolean {
        return this.chatBuilder.isEmpty()
    }

    public isVisible(): boolean {
        return this.webviewPanelOrView?.visible ?? false
    }

    private async syncChatBuilderPrimaryAsset(primaryAssetId?: string): Promise<void> {
        if (primaryAssetId) {
            const response = await getPrimaryAsset({
                id: primaryAssetId,
                limit: 1,
                offset: 0,
                kind: [PrimaryAsset.CODEBASE],
            })
            const primaryAsset = response.results[0]
            this.chatBuilder.setPrimaryAsset(primaryAsset)
        } else {
            this.chatBuilder.setPrimaryAsset(undefined)
        }

        this.postViewTranscript()
    }
}

function newChatModelFromSerializedChatTranscript(
    json: SerializedChatTranscript,
    modelID: string | undefined,
    newSessionID?: string
): ChatBuilder {
    return new ChatBuilder(
        modelID,
        newSessionID ?? json.id,
        json.llmSessionId,
        json.primaryAssetId,
        json.interactions.flatMap((interaction: SerializedChatInteraction): ChatMessage[] =>
            [
                PromptString.unsafe_deserializeChatMessage(interaction.humanMessage),
                interaction.assistantMessage
                    ? PromptString.unsafe_deserializeChatMessage(interaction.assistantMessage)
                    : null,
            ].filter(isDefined)
        ),
        json.chatTitle
    )
}

export function disposeWebviewViewOrPanel(viewOrPanel: vscode.WebviewView | vscode.WebviewPanel): void {
    if ('dispose' in viewOrPanel) {
        viewOrPanel.dispose()
    }
}

export function webviewViewOrPanelViewColumn(
    viewOrPanel: vscode.WebviewView | vscode.WebviewPanel
): vscode.ViewColumn | undefined {
    if ('viewColumn' in viewOrPanel) {
        return viewOrPanel.viewColumn
    }
    // Our view is in the sidebar, return undefined
    return undefined
}

export function webviewViewOrPanelOnDidChangeViewState(
    viewOrPanel: vscode.WebviewView | vscode.WebviewPanel
): vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent> {
    if ('onDidChangeViewState' in viewOrPanel) {
        return viewOrPanel.onDidChangeViewState
    }
    // Return a no-op (this means the provider is for the sidebar)
    return () => {
        return {
            dispose: () => {},
        }
    }
}

export function revealWebviewViewOrPanel(viewOrPanel: vscode.WebviewView | vscode.WebviewPanel): void {
    if ('reveal' in viewOrPanel) {
        viewOrPanel.reveal()
    }
}

/**
 * Set HTML for webview (panel) & webview view (sidebar)
 */
async function addWebviewViewHTML(
    extensionUri: vscode.Uri,
    view: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
    const webviewPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webviews')
    const root = vscode.Uri.joinPath(webviewPath, 'index.html')
    const bytes = await vscode.workspace.fs.readFile(root)
    const html = new TextDecoder('utf-8').decode(bytes)

    view.webview.html = manipulateWebviewHTML(html, {
        cspSource: view.webview.cspSource,
        resources: view.webview.asWebviewUri(webviewPath),
        // injectScript: config?.injectScript ?? undefined,
        // injectStyle: config?.injectStyle ?? undefined,
    })
}

interface TransformHTMLOptions {
    cspSource: string
    resources?: vscode.Uri
    injectScript?: string
    injectStyle?: string
}

// Exported for testing purposes
export function manipulateWebviewHTML(html: string, options: TransformHTMLOptions): string {
    if (options.resources) {
        html = html.replaceAll('./', `${options.resources}/`)
    }

    // If a script or style is injected, replace the placeholder with the script or style
    // and drop the content-security-policy meta tag which prevents inline scripts and styles
    if (options.injectScript || options.injectStyle) {
        html = html
            .replace(/<!-- START CSP -->.*<!-- END CSP -->/s, '')
            .replaceAll('/*injectedScript*/', options.injectScript ?? '')
            .replaceAll('/*injectedStyle*/', options.injectStyle ?? '')
    } else {
        // Update URIs for content security policy to only allow specific scripts to be run
        html = html.replaceAll("'self'", options.cspSource).replaceAll('{cspSource}', options.cspSource)
    }

    return html
}

async function computeContext(
    _requestID: string,
    { text, mentions }: HumanInput,
    editorState: SerializedPromptEditorState | null,
    editor: ChatControllerOptions['editor'],
    contextRetriever: Pick<ContextRetriever, 'retrieveContext'>,
    signal?: AbortSignal,
    skipQueryRewrite = false
): Promise<{
    contextItems?: ContextItem[]
    error?: Error
    abort?: boolean
}> {
    try {
        return wrapInActiveSpan('chat.computeContext', async span => {
            const contextAlternatives = await computeContextAlternatives(
                contextRetriever,
                editor,
                { text, mentions },
                editorState,
                span,
                signal,
                skipQueryRewrite
            )
            return { contextItems: contextAlternatives[0].items }
        })
    } catch (e) {
        return { error: new Error(`Unexpected error computing context, no context was used: ${e}`) }
    }
}

async function computeContextAlternatives(
    contextRetriever: Pick<ContextRetriever, 'retrieveContext'>,
    editor: ChatControllerOptions['editor'],
    { text, mentions }: HumanInput,
    editorState: SerializedPromptEditorState | null,
    span: Span,
    signal?: AbortSignal,
    skipQueryRewrite = false
): Promise<RankedContext[]> {
    // Remove context chips (repo, @-mentions) from the input text for context retrieval.
    const inputTextWithoutContextChips = editorState
        ? PromptString.unsafe_fromUserQuery(
              inputTextWithoutContextChipsFromPromptEditorState(editorState)
          )
        : text
    const structuredMentions = toStructuredMentions(mentions)
    const retrievedContextPromise = contextRetriever.retrieveContext(
        structuredMentions,
        inputTextWithoutContextChips,
        span,
        signal,
        skipQueryRewrite
    )
    const openCtxContextPromise = getContextForChatMessage(text.toString(), signal)
    const [retrievedContext, openCtxContext] = await Promise.all([
        retrievedContextPromise.catch((e: any) => {
            throw new Error(`Failed to retrieve search context: ${e}`)
        }),
        openCtxContextPromise,
    ])

    const resolvedExplicitMentionsPromise = resolveContextItems(
        editor,
        [
            structuredMentions.symbols,
            structuredMentions.files,
            structuredMentions.openCtx,
            structuredMentions.mediaFiles,
        ].flat(),
        text,
        signal
    )

    return [
        {
            strategy: 'local+remote',
            items: combineContext(
                await resolvedExplicitMentionsPromise,
                openCtxContext,
                retrievedContext
            ),
        },
    ]
}

// This is the manual ordering of the different retrieved and explicit context sources
// It should be equivalent to the ordering of things in
// ChatController:legacyComputeContext > context.ts:resolveContext
function combineContext(
    explicitMentions: ContextItem[],
    openCtxContext: ContextItemOpenCtx[],
    retrievedContext: ContextItem[]
): ContextItem[] {
    return [explicitMentions, openCtxContext, retrievedContext].flat()
}
