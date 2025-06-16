import {
    type AuthCredentials,
    type AuthStatus,
    EMPTY,
    NEVER,
    type Unsubscribable,
    abortableOperation,
    authStatus,
    combineLatest,
    disposableSubscription,
    distinctUntilChanged,
    clientCapabilities as getClientCapabilities,
    isAbortError,
    resolvedConfig as resolvedConfig_,
    setAuthStatusObservable as setAuthStatusObservable_,
    startWith,
    switchMap,
    withLatestFrom,
} from '@sourcegraph/cody-shared'
import { isNeedsAuthChallengeError } from '@sourcegraph/cody-shared/src/sourcegraph-api/errors'
import isEqual from 'lodash/isEqual'
import { Observable, Subject, interval } from 'observable-fns'
import * as vscode from 'vscode'
import { type ResolvedConfigurationCredentialsOnly, validateCredentials } from '../auth/auth'
import { logError } from '../output-channel-logger'
import { localStorage } from './LocalStorageProvider'

const HAS_AUTHENTICATED_BEFORE_KEY = 'has-authenticated-before'

class AuthProvider implements vscode.Disposable {
    private status = new Subject<AuthStatus>()
    private refreshRequests = new Subject<boolean>()

    /**
     * Credentials that were already validated with
     * {@link AuthProvider.validateAndStoreCredentials}.
     */
    private lastValidatedAndStoredCredentials =
        new Subject<ResolvedConfigurationCredentialsOnly | null>()

    private hasAuthed = false

    private subscriptions: Unsubscribable[] = []

    private async validateAndUpdateAuthStatus(
        credentials: ResolvedConfigurationCredentialsOnly,
        signal?: AbortSignal,
        resetInitialAuthStatus?: boolean
    ): Promise<void> {
        if (resetInitialAuthStatus ?? true) {
            // Immediately emit the unauthenticated status while we are authenticating.
            // Emitting `authenticated: false` for a brief period is both true and a
            // way to ensure that subscribers are robust to changes in
            // authentication status.
            this.status.next({
                authenticated: false,
                pendingValidation: true,
            })
        }

        try {
            const authStatus = await validateCredentials(credentials, signal)
            signal?.throwIfAborted()
            this.status.next(authStatus)
            await this.handleAuthTelemetry(authStatus, signal)
        } catch (error) {
            if (!isAbortError(error)) {
                logError('AuthProvider', 'Unexpected error validating credentials', error)
            }
        }
    }

    constructor(setAuthStatusObservable = setAuthStatusObservable_, resolvedConfig = resolvedConfig_) {
        // TODO: (cd) verify this is still needed.
        // Emit initial value before setting as source
        this.status.next({
            authenticated: false,
            pendingValidation: true,
        })

        setAuthStatusObservable(this.status.pipe(distinctUntilChanged()))

        const credentialsChangesNeedingValidation = resolvedConfig.pipe(
            withLatestFrom(this.lastValidatedAndStoredCredentials.pipe(startWith(null))),
            switchMap(([config, lastValidatedCredentials]) => {
                const credentials: ResolvedConfigurationCredentialsOnly =
                    toCredentialsOnlyNormalized(config)
                return isEqual(credentials, lastValidatedCredentials)
                    ? NEVER
                    : Observable.of(credentials)
            }),
            distinctUntilChanged()
        )

        // Perform auth as config changes.
        this.subscriptions.push(
            combineLatest(
                credentialsChangesNeedingValidation,
                this.refreshRequests.pipe(startWith(true))
            )
                .pipe(
                    abortableOperation(async ([config, resetInitialAuthStatus], signal) => {
                        if (getClientCapabilities().isDriverWeb) {
                            // Driver Web calls {@link AuthProvider.validateAndStoreCredentials}
                            // explicitly. This early exit prevents duplicate authentications during
                            // the initial load.
                            return
                        }
                        await this.validateAndUpdateAuthStatus(config, signal, resetInitialAuthStatus)
                    })
                )
                .subscribe({})
        )

        // Try to reauthenticate periodically when the authentication failed due to an availability
        // error (which is ephemeral and the underlying error condition may no longer exist).
        this.subscriptions.push(
            authStatus
                .pipe(
                    switchMap(authStatus => {
                        if (!authStatus.authenticated && isNeedsAuthChallengeError(authStatus.error)) {
                            // This interval is short because we want to quickly authenticate after
                            // the user successfully performs the auth challenge. If automatic auth
                            // refresh is expanded to include other conditions (such as any network
                            // connectivity gaps), it should probably have a longer interval, and we
                            // need to respect
                            // https://linear.app/sourcegraph/issue/CODY-3745/codys-background-periodic-network-access-causes-2fa.
                            const intervalMsec = 2500
                            return interval(intervalMsec)
                        }
                        return EMPTY
                    })
                )
                .subscribe(() => {
                    this.refreshRequests.next(false)
                })
        )

        // Keep context updated with auth status.
        this.subscriptions.push(
            authStatus.subscribe(authStatus => {
                try {
                    vscode.commands.executeCommand('authStatus.update', authStatus)
                    vscode.commands.executeCommand(
                        'setContext',
                        'driver-ai.activated',
                        authStatus.authenticated
                    )
                } catch (error) {
                    logError('AuthProvider', 'Unexpected error while setting context', error)
                }
            })
        )

        this.subscriptions.push(
            disposableSubscription(
                vscode.commands.registerCommand('driver-ai.auth.refresh', () => this.refresh())
            )
        )
    }

    private async handleAuthTelemetry(authStatus: AuthStatus, signal?: AbortSignal): Promise<void> {
        // If the extension is authenticated on startup, it can't be a user's first
        // ever authentication. We store this to prevent logging first-ever events
        // for already existing users.
        const hasAuthed = this.hasAuthed
        this.hasAuthed = true
        if (!hasAuthed && authStatus.authenticated) {
            await this.setHasAuthenticatedBefore()
            signal?.throwIfAborted()
        } else if (authStatus.authenticated) {
            this.handleFirstEverAuthentication()
        }
    }

    public dispose(): void {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe()
        }
    }

    /**
     * Refresh the auth status.
     */
    public refresh(resetInitialAuthStatus = true): void {
        this.lastValidatedAndStoredCredentials.next(null)
        this.refreshRequests.next(resetInitialAuthStatus)
    }

    public signout(): void {
        this.lastValidatedAndStoredCredentials.next(null)
        this.status.next({
            authenticated: false,
            pendingValidation: false,
        })
    }

    public async validateAndStoreCredentials(
        config: ResolvedConfigurationCredentialsOnly | AuthCredentials,
        mode: 'store-if-valid' | 'always-store'
    ): Promise<AuthStatus> {
        let credentials: ResolvedConfigurationCredentialsOnly
        if ('auth' in config) {
            credentials = toCredentialsOnlyNormalized(config)
        } else {
            credentials = toCredentialsOnlyNormalized({
                auth: config,
            })
        }

        const authStatus = await validateCredentials(credentials, undefined)
        const shouldStore = mode === 'always-store' || authStatus.authenticated
        if (shouldStore) {
            await localStorage.saveEndpointAndToken(credentials.auth)
            this.lastValidatedAndStoredCredentials.next(credentials)
            this.status.next(authStatus)
        }
        await this.handleAuthTelemetry(authStatus, undefined)
        return authStatus
    }

    // Logs a telemetry event if the user has never authenticated to Sourcegraph.
    private handleFirstEverAuthentication(): void {
        if (localStorage.get(HAS_AUTHENTICATED_BEFORE_KEY)) {
            // User has authenticated before, noop
            return
        }
        this.setHasAuthenticatedBefore()
    }

    private setHasAuthenticatedBefore() {
        return localStorage.set(HAS_AUTHENTICATED_BEFORE_KEY, 'true')
    }
}

export const authProvider = new AuthProvider()

/**
 * @internal For testing only.
 */
export function newAuthProviderForTest(
    ...args: ConstructorParameters<typeof AuthProvider>
): AuthProvider {
    return new AuthProvider(...args)
}

function toCredentialsOnlyNormalized(
    config: ResolvedConfigurationCredentialsOnly
): ResolvedConfigurationCredentialsOnly {
    return {
        auth: { ...config.auth },
    }
}
