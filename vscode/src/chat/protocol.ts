import type {
    AuthStatus,
    ChatMessage,
    ClientCapabilitiesWithLegacyFields,
    ClientConfig,
    ContextItem,
    ContextItemSource,
    PrimaryAssetRecord,
    ProcessingStep,
    RangeData,
    RequestMessage,
    ResponseMessage,
    SerializedChatMessage,
} from '@sourcegraph/cody-shared'

import type { Uri } from 'vscode'
import type { View } from '../../webviews/tabs/types'

/**
 * The location of where the webview is displayed.
 */
export type WebviewType = 'sidebar' | 'editor'

/**
 * A message sent from the webview to the extension host.
 */
export type WebviewMessage =
    | { command: 'ready' }
    | { command: 'initialized' }
    | ({ command: 'submit' } & WebviewSubmitMessage)
    // | ({ command: 'regenerateCodeBlock' } & WebviewRegenerateCodeBlockMessage)
    | { command: 'restoreHistory'; chatID: string }
    | { command: 'links'; value: string }
    | { command: 'openURI'; uri: Uri; range?: RangeData | undefined | null }
    | {
          command: 'openFileLink'
          uri: Uri
          range?: RangeData | undefined | null
          source?: ContextItemSource | undefined | null
      }
    | {
          command: 'show-page'
          page: string
      }
    | {
          command: 'command'
          id: string
          arg?: string | undefined | null
          args?: Record<string, any> | undefined | null
      }
    | ({ command: 'edit' } & WebviewEditMessage)
    | {
          command: 'copy'
          eventType: 'Button' | 'Keydown'
          text: string
      }
    | {
          command: 'auth'
          authKind:
              | 'signin'
              | 'signout'
              | 'support'
              | 'callback'
              | 'simplified-onboarding'
              | 'switch'
              | 'refresh'
          value?: string | undefined | null
      }
    | { command: 'abort' }
    | {
          command: 'signin'
      }
    | {
          command: 'attribution-search'
          snippet: string
      }
    | { command: 'rpc/request'; message: RequestMessage }
    | {
          command: 'chatSession'
          action: 'duplicate' | 'new'
          sessionID?: string | undefined | null
      }
    | {
          command: 'log'
          level: 'debug' | 'error'
          filterLabel: string
          message: string
      }
    | { command: 'action/confirmation'; id: string; response: boolean }
    | { command: 'devicePixelRatio'; devicePixelRatio: number }
    | {
          command: 'mcp'
          type: 'addServer' | 'removeServer' | 'updateServer'
          name: string
          disabled?: boolean | undefined | null
          config?: Record<string, any> | undefined | null
          toolName?: string | undefined | null
          toolDisabled?: boolean | undefined | null
      }

/**
 * A message sent from the extension host to the webview.
 */
export type ExtensionMessage =
    | {
          type: 'config'
          config: ConfigurationSubsetForWebview & LocalEnv
          clientCapabilities: ClientCapabilitiesWithLegacyFields
          authStatus: AuthStatus
          workspaceFolderUris: string[]
      }
    | {
          type: 'clientConfig'
          clientConfig?: ClientConfig | null | undefined
      }
    | {
          /** Used by JetBrains and not VS Code. */
          type: 'ui/theme'
          cssVariables: IDECssVariables
      }
    | ({ type: 'transcript' } & ExtensionTranscriptMessage)
    | { type: 'view'; view: View }
    | { type: 'rateLimit'; isRateLimited: boolean }
    | { type: 'errors'; errors: string }
    | {
          type: 'clientAction'
          addContextItemsToLastHumanInput?: ContextItem[] | null | undefined
          appendTextToLastPromptEditor?: string | null | undefined
          setLastHumanInputIntent?: ChatMessage['intent'] | null | undefined
          submitHumanInput?: boolean | undefined | null
          setPromptAsInput?: { text: string; autoSubmit: boolean } | undefined | null
          regenerateStatus?:
              | { id: string; status: 'regenerating' | 'done' }
              | { id: string; status: 'error'; error: string }
              | undefined
              | null
      }
    | ({ type: 'attribution' } & ExtensionAttributionMessage)
    | { type: 'rpc/response'; message: ResponseMessage }

interface ExtensionAttributionMessage {
    snippet: string
    attribution?:
        | {
              repositoryNames: string[]
              limitHit: boolean
          }
        | undefined
        | null
    error?: string | undefined | null
}

export interface WebviewSubmitMessage extends WebviewContextMessage {
    text: string
    sourceNodeIds?: string[] | undefined | null

    /** An opaque value representing the text editor's state. @see {ChatMessage.editorState} */
    editorState?: unknown | undefined | null
    manuallySelectedIntent?: ChatMessage['intent'] | undefined | null
    steps?: ProcessingStep[] | undefined | null
}

interface WebviewEditMessage extends WebviewContextMessage {
    text: string
    sourceNodeIds?: string[] | undefined | null
    index?: number | undefined | null

    /** An opaque value representing the text editor's state. @see {ChatMessage.editorState} */
    editorState?: unknown | undefined | null
    manuallySelectedIntent?: ChatMessage['intent'] | undefined | null
    steps?: ProcessingStep[] | undefined | null
}

interface WebviewContextMessage {
    contextItems?: ContextItem[] | undefined | null
}

export interface ExtensionTranscriptMessage {
    messages: SerializedChatMessage[]
    isMessageInProgress: boolean
    chatID?: string
    primaryAsset?: PrimaryAssetRecord
    primaryAssetLoaded?: boolean
}

/**
 * The subset of configuration that is visible to the webview.
 */
export interface ConfigurationSubsetForWebview {
    multipleWebviewsEnabled: boolean
    // Type/location of the current webview.
    webviewType?: WebviewType | undefined | null
}

/** The local environment of the editor. */
export interface LocalEnv {
    /** Whether the extension is running in VS Code Web (as opposed to VS Code Desktop). */
    uiKindIsWeb: boolean
}

interface IDECssVariables {
    [key: string]: string
}
