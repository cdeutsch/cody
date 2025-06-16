import type { ChatSession } from './chat/chat-view/ChatController'

export type CommandResult = ChatCommandResult
export interface ChatCommandResult {
    type: 'chat'
    session?: ChatSession
}
