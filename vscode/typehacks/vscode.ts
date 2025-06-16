/// <reference types="vscode" />
declare module 'vscode' {
    export namespace commands {
        type CompileTimeError<T extends string> = { __errorMessage: T } & { __error: 'ERROR' }
        export type DriverCommandString = `driver-ai.${string}` | `_driver-ai.${string}`
        export function registerCommand(
            command: DriverCommandString,
            callback: (...args: any[]) => any,
            thisArg?: any
        ): Disposable

        /**
         * @deprecated Commands must (generally) be prefixed with `driver-ai` or `_driver-ai`
         */
        export function registerCommand(
            command: string,
            callback: (...args: any[]) => any,
            thisArg?: any
        ): CompileTimeError<'Commands must (generally) be prefixed with `driver-ai` or `_driver-ai`'>

        export function registerTextEditorCommand(
            command: DriverCommandString,
            callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void,
            thisArg?: any
        ): Disposable

        /**
         * @deprecated Commands must (generally) be prefixed with `driver-ai` or `_driver-ai`
         */
        export function registerTextEditorCommand(
            command: string,
            callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void,
            thisArg?: any
        ): CompileTimeError<'Commands must (generally) be prefixed with `driver-ai` or `_driver-ai`'>
    }
}
