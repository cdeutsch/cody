// cspell:ignore symf
import type { AxiosError } from 'axios'
import { filter, map } from 'observable-fns'
import * as vscode from 'vscode'

import {
    type ConfigurationInput,
    combineLatest,
    currentAuthStatus,
    currentResolvedConfig,
    distinctUntilChanged,
    fromVSCodeEvent,
    getGlobalApi,
    initializeGlobalApi,
    modelsService,
    resolvedConfig,
    setClientCapabilities,
    setClientNameVersion,
    setEditorWindowIsFocused,
    setLogger,
    setResolvedConfigurationObservable,
    startWith,
    subscriptionDisposable,
} from '@sourcegraph/cody-shared'

import { isReinstalling } from '../uninstall/reinstall'

import { showSignInMenu, showSignOutMenu, tokenCallbackHandler } from './auth/auth'
import { ChatsController } from './chat/chat-view/ChatsController'
import { ContextRetriever } from './chat/chat-view/ContextRetriever'
import { CodeActionProvider } from './code-actions/CodeActionProvider'

import { resolveAuth } from '@sourcegraph/cody-shared/src/configuration/auth-resolver'
import { ChatSidebarViewType } from './chat/chat-view/ChatController'
import { getConfiguration } from './configuration'
import { logGlobalStateEmissions } from './dev/helpers'
import { manageDisplayPathEnvInfoForExtension } from './editor/displayPathEnvInfo'
import { VSCodeEditor } from './editor/vscode-editor'
import { defaultVSCodeExtensionClient } from './extension-client'
import type { PlatformContext } from './extension.common'
import { configureExternalServices } from './external-services'
import { logDebug, logError } from './output-channel-logger'
import { initVSCodeGitApi } from './repository/git-extension-api'
import { authProvider } from './services/AuthProvider'
import { displayHistoryQuickPick } from './services/HistoryChat'
import { localStorage } from './services/LocalStorageProvider'
import { VSCodeSecretStorage, secretStorage } from './services/SecretStorageProvider'
import { CodyStatusBar } from './services/StatusBar'
import { exportOutputLog } from './services/utils/export-logs'
import { dumpDriverHeapSnapshot } from './services/utils/heap-dump'
import { openDriverIssueReporter } from './services/utils/issue-reporter'
import { parseAllVisibleDocuments, updateParseTreeOnEdit } from './tree-sitter/parse-tree-cache'
import { version } from './version'

/**
 * Start the extension, watching all relevant configuration and secrets for changes.
 */
export async function start(
    context: vscode.ExtensionContext,
    platform: PlatformContext
): Promise<vscode.Disposable> {
    const disposables: vscode.Disposable[] = []

    //TODO: Add override flag
    const isExtensionModeDevOrTest =
        context.extensionMode === vscode.ExtensionMode.Development ||
        context.extensionMode === vscode.ExtensionMode.Test

    // Set internal storage fields for storage provider singletons
    localStorage.setStorage(
        platform.createStorage ? await platform.createStorage() : context.globalState
    )

    if (secretStorage instanceof VSCodeSecretStorage) {
        secretStorage.setStorage(context.secrets)
    }

    setLogger({ logDebug, logError })

    setClientCapabilities({
        configuration: getConfiguration(),
        agentCapabilities: platform.extensionClient.capabilities,
    })

    let hasReinstallCleanupRun = false

    setResolvedConfigurationObservable(
        combineLatest(
            fromVSCodeEvent(vscode.workspace.onDidChangeConfiguration).pipe(
                filter(
                    event =>
                        event.affectsConfiguration('driver-ai') ||
                        event.affectsConfiguration('openctx') ||
                        event.affectsConfiguration('http')
                ),
                startWith(undefined),
                map(() => getConfiguration()),
                distinctUntilChanged()
            ),
            fromVSCodeEvent(secretStorage.onDidChange.bind(secretStorage)).pipe(
                startWith(undefined),
                map(() => secretStorage)
            ),
            localStorage.clientStateChanges.pipe(distinctUntilChanged())
        ).pipe(
            map(
                ([clientConfiguration, clientSecrets, clientState]) =>
                    ({
                        clientConfiguration,
                        clientSecrets,
                        clientState,
                        reinstall: {
                            isReinstalling,
                            onReinstall: async () => {
                                // short circuit so that we only run this cleanup once, not every time the config updates
                                if (hasReinstallCleanupRun) return
                                logDebug('start', 'Reinstalling Driver')
                                // VSCode does not provide a way to simply clear all secrets
                                // associated with the extension (https://github.com/microsoft/vscode/issues/123817)
                                // So we have to build a list of all endpoints we'd expect to have been populated
                                // and clear them individually.
                                // const history = await localStorage.deleteEndpointHistory();
                                // const additionalEndpointsToClear = [
                                //   clientConfiguration.overrideServerEndpoint,
                                //   clientState.lastUsedEndpoint,
                                //   DOTCOM_URL.toString(),
                                // ].filter(_.isString);
                                // await Promise.all(
                                //   history.concat(additionalEndpointsToClear).map(clientSecrets.deleteToken.bind(clientSecrets))
                                // );
                                hasReinstallCleanupRun = true
                            },
                        },
                    }) satisfies ConfigurationInput
            )
        )
    )

    setEditorWindowIsFocused(() => vscode.window.state.focused)

    if (process.env.LOG_GLOBAL_STATE_EMISSIONS) {
        disposables.push(logGlobalStateEmissions())
    }

    disposables.push(await register(context, platform, isExtensionModeDevOrTest))
    return vscode.Disposable.from(...disposables)
}

// Registers commands and webview given the config.
const register = async (
    context: vscode.ExtensionContext,
    platform: PlatformContext,
    isExtensionModeDevOrTest: boolean
): Promise<vscode.Disposable> => {
    const disposables: vscode.Disposable[] = []
    setClientNameVersion({
        newClientName: platform.extensionClient.clientName,
        newClientCompletionsStreamQueryParameterName:
            platform.extensionClient.httpClientNameForLegacyReasons,
        newClientVersion: platform.extensionClient.clientVersion,
    })

    const config = vscode.workspace.getConfiguration()
    const baseUrl = config.get<string>('driver-ai.apiUrl') || 'https://api.us1.driverai.com'

    initializeGlobalApi({ baseUrl })

    // Add response interceptor for error handling
    getGlobalApi().interceptors.response.use(
        response => response,
        async (error: AxiosError) => {
            if (error.response?.status === 401) {
                // void vscode.window.showErrorMessage('Authentication required');
                const { configuration } = await currentResolvedConfig()
                const auth = await resolveAuth(configuration, secretStorage)
                const authStatus = await authProvider.validateAndStoreCredentials(auth, 'always-store')
                if (!authStatus.authenticated) {
                    // Delete the token from the storage.
                    await secretStorage.deleteToken()
                }
            }
            return Promise.reject(error)
        }
    )

    // Initialize `displayPath` first because it might be used to display paths in error messages
    // from the subsequent initialization.
    disposables.push(manageDisplayPathEnvInfoForExtension())

    // Initialize singletons
    await initializeSingletons(platform, disposables)

    // Ensure Git API is available
    disposables.push(await initVSCodeGitApi())

    registerParserListeners(disposables)

    // Initialize external services
    const {
        // chatClient,
        // completionsClient,
        // guardrails,
        symfRunner,
        dispose: disposeExternalServices,
    } = await configureExternalServices(context, platform)
    disposables.push({ dispose: disposeExternalServices })

    const editor = new VSCodeEditor()
    const contextRetriever = new ContextRetriever(editor, symfRunner)

    const { chatsController } = registerChat(
        {
            context,
            editor,
            contextRetriever,
        },
        disposables
    )
    disposables.push(chatsController)

    const statusBar = CodyStatusBar.init()
    disposables.push(statusBar)

    registerAuthCommands(disposables)
    registerChatCommands(disposables)
    // if (isExtensionModeDevOrTest) {
    //   await registerTestCommands(context, disposables);
    // }
    registerDebugCommands(context, disposables)
    registerUpgradeHandlers(disposables)

    // INC-267 do NOT await on this promise. This promise triggers
    // `vscode.window.showInformationMessage()`, which only resolves after the
    // user has clicked on "Setup". Awaiting on this promise will make the Cody
    // extension timeout during activation.
    // resolvedConfig.pipe(take(1)).subscribe(({ auth }) => showSetupNotification(auth))

    // Save config for `deactivate` handler.
    disposables.push(
        subscriptionDisposable(
            resolvedConfig.subscribe(config => {
                localStorage.setConfig(config)
            })
        )
    )

    return vscode.Disposable.from(...disposables)
}

async function initializeSingletons(
    platform: PlatformContext,
    disposables: vscode.Disposable[]
): Promise<void> {
    // commandControllerInit(platform.createCommandsProvider?.(), platform.extensionClient.capabilities)

    modelsService.setStorage(localStorage)

    if (platform.otherInitialization) {
        disposables.push(platform.otherInitialization())
    }
}

// Registers listeners to trigger parsing of visible documents
function registerParserListeners(disposables: vscode.Disposable[]) {
    void parseAllVisibleDocuments()
    disposables.push(vscode.window.onDidChangeVisibleTextEditors(parseAllVisibleDocuments))
    disposables.push(vscode.workspace.onDidChangeTextDocument(updateParseTreeOnEdit))
}

function registerChatCommands(disposables: vscode.Disposable[]): void {
    disposables.push(
        // Chat
        vscode.commands.registerCommand('driver-ai.settings.extension', () =>
            vscode.commands.executeCommand('workbench.action.openSettings', {
                query: '@ext:driver-ai.driver-chat',
            })
        ),
        vscode.commands.registerCommand('driver-ai.chat.view.popOut', async () => {
            vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow')
        }),
        vscode.commands.registerCommand('driver-ai.chat.history.panel', async () => {
            await displayHistoryQuickPick(currentAuthStatus())
        }),
        vscode.commands.registerCommand('driver-ai.settings.extension.chat', () =>
            vscode.commands.executeCommand('workbench.action.openSettings', {
                query: '@ext:driver-ai.driver-chat chat',
            })
        ),
        vscode.commands.registerCommand('driver-ai.copy.version', () =>
            vscode.env.clipboard.writeText(version)
        )
    )
}

function registerAuthCommands(disposables: vscode.Disposable[]): void {
    disposables.push(
        vscode.commands.registerCommand('driver-ai.auth.signin', () => showSignInMenu()),
        vscode.commands.registerCommand('driver-ai.auth.signout', () => showSignOutMenu())
        // vscode.commands.registerCommand('driver-ai.auth.account', () => showAccountMenu()),
        // vscode.commands.registerCommand('driver-ai.auth.support', () => showFeedbackSupportQuickPick()),
    )
}

function registerUpgradeHandlers(disposables: vscode.Disposable[]): void {
    disposables.push(
        // Register URI Handler (e.g. vscode://driver-ai.driver-chat)
        vscode.window.registerUriHandler({
            handleUri: async (uri: vscode.Uri) => {
                if (uri.path === '/app-done') {
                    // This is an old re-entrypoint from App that is a no-op now.
                } else {
                    void tokenCallbackHandler(uri)
                }
            },
        })
    )
}

/**
 * Register commands used for debugging.
 */
async function registerDebugCommands(
    context: vscode.ExtensionContext,
    disposables: vscode.Disposable[]
): Promise<void> {
    disposables.push(
        vscode.commands.registerCommand('driver-ai.debug.export.logs', () =>
            exportOutputLog(context.logUri)
        ),
        vscode.commands.registerCommand('driver-ai.debug.reportIssue', () => openDriverIssueReporter()),
        vscode.commands.registerCommand('driver-ai.debug.heapDump', () => dumpDriverHeapSnapshot())
    )
}

interface RegisterChatOptions {
    context: vscode.ExtensionContext
    editor: VSCodeEditor
    contextRetriever: ContextRetriever
}

function registerChat(
    { context, editor, contextRetriever }: RegisterChatOptions,
    disposables: vscode.Disposable[]
): {
    chatsController: ChatsController
} {
    const extensionClient = defaultVSCodeExtensionClient()

    const chatsController = new ChatsController(
        {
            extensionUri: context.extensionUri,
            editor,
        },
        contextRetriever,
        extensionClient
    )
    chatsController.registerViewsAndCommands()

    disposables.push(new CodeActionProvider())

    // Register a serializer for reviving the chat panel on reload
    if (vscode.window.registerWebviewPanelSerializer) {
        vscode.window.registerWebviewPanelSerializer(ChatSidebarViewType, {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, chatID: string) {
                if (chatID && webviewPanel.title) {
                    logDebug('main:deserializeWebviewPanel', 'reviving last unclosed chat panel')
                    await chatsController.restoreToPanel(webviewPanel, chatID)
                }
            },
        })
    }

    return { chatsController }
}
