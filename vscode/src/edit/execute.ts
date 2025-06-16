import type * as vscode from 'vscode'

import type {
    ContextItem,
    ContextMessage,
    EditModel,
    EventSource,
    PromptString,
    Rule,
} from '@sourcegraph/cody-shared'

import type { EditIntent, EditMode } from './types'

export interface ExecuteEditArguments {
    configuration?: {
        /**
         * The document in which to apply the edit.
         * Defaults to the active document.
         */
        document?: vscode.TextDocument
        /**
         * The range in the document in which to apply the edit.
         * Defaults to the active selection rnage.
         */
        range?: vscode.Range
        /**
         * A pre-set instruction that will be used to create the edit.
         * This will skip prompting the user for any other instruction.
         */
        instruction?: PromptString
        /**
         * A pre-set instruction that will be used to help the user write their instruction.
         * This will prompt the user with this text as a prefix provided in the edit input.
         */
        preInstruction?: PromptString
        userContextFiles?: ContextItem[]
        contextMessages?: ContextMessage[]
        intent?: EditIntent
        mode?: EditMode
        model?: EditModel
        rules?: Rule[] | null
        // The file to write the edit to. If not provided, the edit will be applied to the current file.
        destinationFile?: vscode.Uri
        insertionPoint?: vscode.Position
    }
    source?: EventSource
}
