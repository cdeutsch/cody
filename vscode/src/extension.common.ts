import * as vscode from 'vscode'

import { onActivationDevelopmentHelpers } from './dev/helpers'
import './editor/displayPathEnvInfo' // import for side effects
import type { createController } from '@openctx/vscode-lib'
import type { Noxide } from '@sourcegraph/cody-noxide'
import { getPrimaryAssetByRepoName, getTechDocContent } from '@sourcegraph/cody-shared'
import { marked } from 'marked'
import { ExtensionApi } from './extension-api'
import type { ExtensionClient } from './extension-client'
import { getGitRepositoryName } from './git-utils'
import type { SymfRunner } from './local-context/symf'
import { start } from './main'

type Constructor<T extends new (...args: any) => any> = T extends new (
    ...args: infer A
) => infer R
    ? (...args: A) => R
    : never

export interface PlatformContext {
    // networkAgent?: DelegatingAgent
    noxide?: Noxide
    createOpenCtxController?: typeof createController
    createStorage?: () => Promise<vscode.Memento>
    // createCommandsProvider?: Constructor<typeof CommandsProvider>
    createSymfRunner?: Constructor<typeof SymfRunner>
    // createCompletionsClient: (logger?: CompletionLogger) => SourcegraphCompletionsClient
    // createSentryService?: () => SentryService
    // createOpenTelemetryService?: () => OpenTelemetryService
    // startTokenReceiver?: typeof startTokenReceiver
    otherInitialization?: () => vscode.Disposable
    extensionClient: ExtensionClient
}

interface ActivationContext {
    initializeNoxideLib?: () => Noxide | undefined
    // initializeNetworkAgent?: (ctx: { noxide?: Noxide | undefined }) => Promise<DelegatingAgent>
}

export async function activate(
    context: vscode.ExtensionContext,
    {
        // initializeNetworkAgent,
        initializeNoxideLib,
        ...platformContext
    }: PlatformContext & ActivationContext
): Promise<ExtensionApi> {
    //TODO: Properly handle extension mode overrides in a single way
    platformContext.noxide = initializeNoxideLib?.() || undefined
    const api = new ExtensionApi(context.extensionMode)
    try {
        // Important! This needs to happen before we resolve the config
        // Otherwise some eager beavers might start making network requests
        // const networkAgent = await initializeNetworkAgent?.(platformContext)
        // if (networkAgent) {
        //     context.subscriptions.push(networkAgent)
        //     platformContext.networkAgent = networkAgent
        // }
        const disposable = await start(context, platformContext)
        if (!context.globalState.get('extension.hasActivatedPreviously')) {
            void context.globalState.update('extension.hasActivatedPreviously', 'true')
        }

        // The command has been defined in the package.json file
        // Now provide the implementation of the command with registerCommand
        // The commandId parameter must match the command field in package.json
        const viewDocsCommandOnline = vscode.commands.registerCommand(
            'driver-ai.viewDriverDocsOnline',
            async () => {
                // Get the relative file path of the active text editor
                const editor = vscode.window.activeTextEditor
                if (!editor) {
                    vscode.window.showErrorMessage('No active text editor found')
                    return
                }

                const filePath = editor.document.uri.path
                const relativePath = vscode.workspace.asRelativePath(filePath)
                const repoName = await getGitRepositoryName()

                console.debug('Repository name:', repoName)
                console.debug('Relative path:', relativePath)

                const url = `http://localhost:3000/vs/${repoName}/${relativePath}`
                vscode.env.openExternal(vscode.Uri.parse(url))
            }
        )

        const viewDocsCommand = vscode.commands.registerCommand('driver-ai.viewDriverDocs', async () => {
            // Get the relative file path of the active text editor
            const editor = vscode.window.activeTextEditor
            if (!editor) {
                vscode.window.showErrorMessage('No active text editor found')
                return
            }

            const filePath = editor.document.uri.path
            const relativePath = vscode.workspace.asRelativePath(filePath)

            const repoName = await getGitRepositoryName()

            const primaryAsset = await getPrimaryAssetByRepoName(repoName)

            console.debug('Repository name:', repoName)
            console.debug('Primary asset id:', primaryAsset)

            if (!primaryAsset) {
                vscode.window.showErrorMessage('No primary asset found')
                return
            }

            const documentSet = await getTechDocContent({
                nodeKind: 'file',
                path: `${repoName}/${relativePath}`,
                primaryAssetId: primaryAsset.id,
                versionId: primaryAsset.most_recent_version?.id ?? '',
            })

            if (!documentSet) {
                vscode.window.showErrorMessage('No tech doc content found')
                return
            }

            // Show the tech doc markdown content in a new tab.
            const panel = vscode.window.createWebviewPanel(
                'driver-ai-tech-doc',
                'Driver AI Tech Doc',
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                }
            )

            // Convert the tech doc markdown content to html.
            const html = await marked.parse(documentSet.long_document.content)

            panel.webview.html = html
        })

        context.subscriptions.push(disposable, viewDocsCommandOnline, viewDocsCommand)

        if (context.extensionMode === vscode.ExtensionMode.Development) {
            onActivationDevelopmentHelpers()
        }
    } catch (error) {
        // captureException(error)
        console.error(error)
    }
    return api
}
