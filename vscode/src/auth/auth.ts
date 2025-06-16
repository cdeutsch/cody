// cspell:ignore Jjtv PKCE
import axios from 'axios'
import * as vscode from 'vscode'

import {
    type AuthCredentials,
    type AuthStatus,
    type UnauthenticatedAuthStatus,
    type User,
    clientCapabilities,
    currentAuthStatus,
    currentResolvedConfig,
    getAuthHeadersForToken,
    getBaseApiUrl,
} from '@sourcegraph/cody-shared'
import { resolveAuth } from '@sourcegraph/cody-shared/src/configuration/auth-resolver'
import {
    AuthConfigError,
    InvalidAccessTokenError,
    isInvalidAccessTokenError,
} from '@sourcegraph/cody-shared/src/sourcegraph-api/errors'
import { logDebug } from '../output-channel-logger'
import { authProvider } from '../services/AuthProvider'
import { secretStorage } from '../services/SecretStorageProvider'
import { closeAuthProgressIndicator } from './auth-progress-indicator'

type AuthMenuType = 'signin' | 'switch'

/**
 * Show a quick pick to select the endpoint to sign into.
 */
export async function showSignInMenu(): Promise<void> {
    const curAuthStatus = currentAuthStatus()
    const mode: AuthMenuType = curAuthStatus.authenticated ? 'switch' : 'signin'
    logDebug('AuthProvider:signinMenu', mode)

    // Auto log user if token for the selected instance was found in secret or custom provider is configured
    const { configuration } = await currentResolvedConfig()
    const auth = await resolveAuth(configuration, secretStorage)

    const authStatus = await authProvider.validateAndStoreCredentials(auth, 'store-if-valid')

    // If authentication failed because the credentials were reported as invalid (and not
    // due to some other or some ephemeral reason), ask the user for a different token.
    if (!authStatus?.authenticated && isInvalidAccessTokenError(authStatus.error)) {
        const { configuration } = await currentResolvedConfig()
        const auth = await resolveAuth(configuration, secretStorage)

        let authStatus = await authProvider.validateAndStoreCredentials(auth, 'store-if-valid')

        // If authentication failed because the credentials were reported as invalid (and not
        // due to some other or some ephemeral reason), ask the user for a different token.
        if (!authStatus?.authenticated && isInvalidAccessTokenError(authStatus.error)) {
            const token = await showAccessTokenInputBox()
            if (!token) {
                return
            }
            authStatus = await authProvider.validateAndStoreCredentials(
                { credentials: { token, source: 'paste' } },
                'store-if-valid'
            )
        }
        await showAuthResultMessage(authStatus)
        logDebug('AuthProvider:signinMenu', mode)
    }
    await showAuthResultMessage(authStatus)
    logDebug('AuthProvider:signinMenu', mode)
}

/**
 * Show a VS Code input box to ask the user to enter an access token.
 */
async function showAccessTokenInputBox(): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
        title: 'Driver',
        prompt: 'Paste your access token. To create an access token, go to "Settings" and then "Access tokens" on the Sourcegraph instance.',
        placeHolder: 'Access Token',
        password: true,
        ignoreFocusOut: true,
    })

    if (typeof result === 'string') {
        return result.trim()
    }
    return result
}

async function showAuthResultMessage(authStatus: AuthStatus | undefined): Promise<void> {
    if (authStatus?.authenticated) {
        await vscode.window.showInformationMessage('Signed in.')
    } else {
        await showAuthFailureMessage(authStatus)
    }
}

export async function showAuthFailureMessage(
    authStatus: UnauthenticatedAuthStatus | undefined
): Promise<void> {
    if (authStatus?.error) {
        await vscode.window.showErrorMessage(authStatus.error.message)
    }
}

/**
 * Register URI Handler (vscode://driver-ai.driver-chat) for resolving token sending back from
 * driver.ai.
 */
export async function tokenCallbackHandler(uri: vscode.Uri): Promise<void> {
    closeAuthProgressIndicator()

    const params = new URLSearchParams(uri.query)

    const token = params.get('code') || params.get('token')

    if (!token) {
        return
    }

    const authStatus = await authProvider.validateAndStoreCredentials(
        { credentials: { token, source: 'redirect' } },
        'store-if-valid'
    )
    // telemetryRecorder.recordEvent('driver.auth.fromCallback.web', 'succeeded', {
    //   metadata: {
    //     success: authStatus?.authenticated ? 1 : 0,
    //   },
    //   billingMetadata: {
    //     product: 'driver',
    //     category: 'billable',
    //   },
    // });
    if (authStatus?.authenticated) {
        await vscode.window.showInformationMessage('Signed in to Driver')
    } else {
        await showAuthFailureMessage(authStatus)
    }
}

export function formatURL(uri: string): string | null {
    try {
        if (!uri) {
            return null
        }

        // Check if the URI is a sourcegraph token
        // if (isSourcegraphToken(uri)) {
        //   throw new Error('Access Token is not a valid URL');
        // }

        // Check if the URI is in the correct URL format
        // Add missing https:// if needed
        if (!uri.startsWith('http')) {
            uri = `https://${uri}`
        }

        const endpointUri = new URL(uri)
        return endpointUri.href
    } catch (error) {
        console.error('Invalid URL: ', error)
        return null
    }
}

export async function showSignOutMenu(): Promise<void> {
    await signOut()
}

/**
 * Log user out of the selected endpoint (remove token from secret).
 */
export async function signOut(): Promise<void> {
    // Delete the access token from the Sourcegraph instance on signout if it was created
    // through automated redirect. We don't delete manually entered tokens as they may be
    // used for other purposes, such as the Driver CLI etc.
    // Do not block signout on token deletion, signout should be as fast as possible.
    // Promise.all([secretStorage.getToken(), secretStorage.getTokenSource()]).then(([token, tokenSource]) => {
    //   if (token && tokenSource === 'redirect') {
    //     void graphqlClient.DeleteAccessToken(token);
    //   }
    // });

    await secretStorage.deleteToken()

    authProvider.signout()
}

/**
 * The subset of {@link ResolvedConfiguration} that is needed for authentication.
 */
export type ResolvedConfigurationCredentialsOnly = { auth: AuthCredentials }

/**
 * Validate the auth credentials.
 */
export async function validateCredentials(
    config: ResolvedConfigurationCredentialsOnly,
    signal?: AbortSignal
): Promise<AuthStatus> {
    if (config.auth.error !== undefined) {
        logDebug('auth', 'Failed to authenticate due to configuration error', config.auth.error)
        return {
            authenticated: false,
            pendingValidation: false,
            error: new AuthConfigError(config.auth.error?.message ?? config.auth.error),
        }
    }

    // Credentials are needed except for Driver Web, which uses cookies.
    if (!config.auth.credentials && !clientCapabilities().isDriverWeb) {
        return { authenticated: false, pendingValidation: false }
    }

    logDebug('auth', 'Authenticating...')

    if (config.auth.credentials && 'token' in config.auth.credentials) {
        const user = await getCurrentUserInfo(config.auth.credentials.token, signal)
        signal?.throwIfAborted()
        if (user) {
            return { authenticated: true, pendingValidation: false, user }
        }
    }

    return {
        authenticated: false,
        error: new InvalidAccessTokenError(),
        pendingValidation: false,
    }
}

export async function getCurrentUserInfo(
    apiKey?: string,
    signal?: AbortSignal
): Promise<User | undefined> {
    if (!apiKey) {
        return undefined
    }

    // Validate token against Driver API by getting the user info.
    try {
        const baseApiUrl = getBaseApiUrl()
        const headers = getAuthHeadersForToken(apiKey)
        const userData = await axios.get(`${baseApiUrl}/user/me`, {
            headers: headers,
            signal,
        })
        const orgData = await axios.get(`${baseApiUrl}/user/me/organization`, {
            headers: headers,
            signal,
        })

        const user: User = {
            avatar_url: userData.data.picture,
            org_display_name: orgData.data.display_name,
            org_id: orgData.data.id,
            org_name: orgData.data.name,
            user_email: userData.data.email,
            user_full_name: userData.data.name,
            userId: userData.data.user_id,
        }

        return user
    } catch (error) {
        console.error('Failed to get current user info:', error)

        return undefined
    }
}
