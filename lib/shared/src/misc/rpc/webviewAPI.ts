import { type Observable, map } from 'observable-fns'
import type { AuthStatus, ResolvedConfiguration } from '../..'
import type { SerializedPromptEditorState } from '../..'
import type { GetTreeParams, Tree } from '../../api-types'
import type { ChatHistoryType, LightweightChatHistory } from '../../chat/transcript'
import type { ChatMessage, UserLocalHistory } from '../../chat/transcript/messages'
import type { ContextItem, DefaultContext } from '../../codebase-context/messages'
import type { DriverCommand } from '../../commands/types'
import type { FeatureFlag } from '../../experimentation/FeatureFlagProvider'
import type { ContextMentionProviderMetadata } from '../../mentions/api'
import type { MentionQuery } from '../../mentions/query'
import type { Prompt } from '../../sourcegraph-api/graphql/client-types'
import { type createMessageAPIForWebview, proxyExtensionAPI } from './rpc'

export interface WebviewToExtensionAPI {
    /**
     * Get the data to display in the @-mention menu for the given query.
     */
    mentionMenuData(query: MentionQuery): Observable<MentionMenuData>

    /**
     * Get the evaluated value of a feature flag.
     */
    evaluatedFeatureFlag(flag: FeatureFlag): Observable<boolean | undefined>

    /**
     * List repositories that match the given query for the repository filter in search results.
     */
    repos(input: ReposInput): Observable<ReposResults>

    getTree(input: GetTreeParams): Observable<Tree>

    hydratePromptMessage(
        promptText: string,
        initialContext?: ContextItem[]
    ): Observable<SerializedPromptEditorState>

    /**
     * Observe the default context that should be populated in the chat message input field and suggestions.
     */
    defaultContext(): Observable<DefaultContext>

    /**
     * Observe the current resolved configuration (same as the global {@link resolvedConfig}
     * observable).
     */
    resolvedConfig(): Observable<ResolvedConfiguration>

    /**
     * Observe the current auth status (same as the global {@link authStatus} observable).
     */
    authStatus(): Observable<AuthStatus>

    /**
     * Observe the current transcript.
     */
    transcript(): Observable<readonly ChatMessage[]>

    /**
     * The current user's chat history.
     */
    userHistory(type?: ChatHistoryType): Observable<LightweightChatHistory | UserLocalHistory | null>
}

export function createExtensionAPI(
    messageAPI: ReturnType<typeof createMessageAPIForWebview>,

    // As a workaround for Driver Web, support providing static initial context.
    staticDefaultContext?: DefaultContext
): WebviewToExtensionAPI {
    const hydratePromptMessage = proxyExtensionAPI(messageAPI, 'hydratePromptMessage')

    return {
        mentionMenuData: proxyExtensionAPI(messageAPI, 'mentionMenuData'),
        evaluatedFeatureFlag: proxyExtensionAPI(messageAPI, 'evaluatedFeatureFlag'),
        hydratePromptMessage: promptText =>
            hydratePromptMessage(promptText, staticDefaultContext?.initialContext),
        defaultContext: () =>
            proxyExtensionAPI(messageAPI, 'defaultContext')().pipe(
                map(result =>
                    staticDefaultContext
                        ? ({
                              ...result,
                              corpusContext: [
                                  ...result.corpusContext,
                                  ...staticDefaultContext.corpusContext,
                              ],
                              initialContext: [
                                  ...result.initialContext,
                                  ...staticDefaultContext.initialContext,
                              ],
                          } satisfies DefaultContext)
                        : result
                )
            ),
        resolvedConfig: proxyExtensionAPI(messageAPI, 'resolvedConfig'),
        authStatus: proxyExtensionAPI(messageAPI, 'authStatus'),
        transcript: proxyExtensionAPI(messageAPI, 'transcript'),
        userHistory: proxyExtensionAPI(messageAPI, 'userHistory'),
        repos: proxyExtensionAPI(messageAPI, 'repos'),
        getTree: proxyExtensionAPI(messageAPI, 'getTree'),
    }
}

export interface MentionMenuData {
    providers: ContextMentionProviderMetadata[]
    items: (ContextItem & { icon?: string })[] | undefined

    /**
     * If an error is present, the client should display the error *and* still display the other
     * data that is present.
     */
    error?: string
}

export interface ReposInput {
    query?: string
    first: number
}

export type ReposResults = { name: string; id: string }[]

export interface PromptAction extends Prompt {
    actionType: 'prompt'
}

export interface CommandAction extends DriverCommand {
    actionType: 'command'
}

export interface PromptsInput {
    query: string
    first?: number
    recommendedOnly: boolean
    tags?: string[]
    owner?: string
    includeViewerDrafts?: boolean
    builtinOnly?: boolean
}

export type Action = PromptAction | CommandAction

export interface PromptsResult {
    arePromptsSupported: boolean

    /** List of all available actions (prompts and/or commands) */
    actions: Action[]

    /** The original query used to fetch this result. */
    query: string
}
