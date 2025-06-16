import type { ReadonlyDeep } from './utils'

/**
 * Represents the source of an authentication token generation, either a redirect or paste flow.
 * A redirect flow is initiated by the user clicking a link in the browser, while a paste flow is initiated by the user
 * manually entering the access from into the VsCode App.
 */
export type TokenSource = 'redirect' | 'paste'

/**
 * The user's authentication credentials, which are stored separately from the rest of the
 * configuration.
 */
export interface AuthCredentials {
    credentials: HeaderCredential | TokenCredential | undefined
    error?: any
}

export interface HeaderCredential {
    // We use function instead of property to prevent accidental top level serialization - we never want to store this data
    getHeaders(): Promise<Record<string, string>>
}

export interface TokenCredential {
    token: string
    source?: TokenSource
}

export interface ExternalAuthCommand {
    commandLine: readonly string[]
    environment?: Record<string, string>
    shell?: string
    timeout?: number
    windowsHide?: boolean
}

export interface ExternalAuthProvider {
    endpoint: string
    executable: ExternalAuthCommand
}

interface RawClientConfiguration {
    debugVerbose: boolean

    codeActions: boolean

    // Deep Cody
    agenticContextExperimentalOptions?: AgenticContextConfiguration

    //#region Unstable
    internalDebugContext?: boolean
    internalDebugState?: boolean

    //#region Hidden Settings
    hasNativeWebview: boolean

    /**
     * @deprecated Do not use directly. Call {@link clientCapabilities} instead
     * (`clientCapabilities().agentIDE`) and see the docstring on
     * {@link ClientCapabilitiesWithLegacyFields.agentIDE}.
     */
    agentIDE?: DriverIDE

    //#region Forced Overrides
    /**
     * Overrides always take precedence over other configuration. Specific
     * override flags should be preferred over opaque broad settings /
     * environment variables such as TESTING_MODE which can make it difficult to
     * understand the broad implications such a setting can have.
     */
    overrideAuthToken?: string | undefined

    // DRIVER variables:

    baseUrl: string
}

export interface AgenticContextConfiguration {
    shell?: {
        allow?: string[] | undefined | null
        block?: string[] | undefined | null
    }
}

/**
 * Client configuration, such as VS Code settings.
 */
export type ClientConfiguration = ReadonlyDeep<RawClientConfiguration>

export const DriverIDE = {
    VSCode: 'VSCode',
    JetBrains: 'JetBrains',
    Neovim: 'Neovim',
    Emacs: 'Emacs',
    Web: 'Web',
    VisualStudio: 'VisualStudio',
    Eclipse: 'Eclipse',

    /**
     * The standalone web client in the Driver repository's `web/` tree.
     */
    StandaloneWeb: 'StandaloneWeb',
} as const

export type DriverIDE = (typeof DriverIDE)[keyof typeof DriverIDE]
