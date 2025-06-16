import type { DefaultChatCommands, EventSource, PromptString } from '@sourcegraph/cody-shared'
import * as vscode from 'vscode'
import type { ChatSession } from '../../chat/chat-view/ChatController'
import type { WebviewSubmitMessage } from '../../chat/protocol'

export interface ExecuteChatArguments extends Omit<WebviewSubmitMessage, 'text' | 'editorState'> {
    source?: EventSource
    command?: DefaultChatCommands
    text: PromptString
    submitType?: 'new-chat' | 'continue-chat'
}

/**
 * Wrapper around the `driver-ai.action.chat` command that can be used anywhere but with better type-safety.
 * This is also called by all the default commands (e.g., explain).
 */
export const executeChat = async (args: ExecuteChatArguments): Promise<ChatSession | undefined> => {
    const isCommand = Boolean(args.command)
    if (!isCommand) {
        void vscode.window.showErrorMessage('This feature has been disabled by your site admin.')
        return undefined
    }

    return vscode.commands.executeCommand<ChatSession | undefined>('driver-ai.action.chat', args)
}
