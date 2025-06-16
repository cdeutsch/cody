import merge from 'lodash/merge'
import * as uuid from 'uuid'
import type { ExtensionContext, Memento } from 'vscode'
import { EventEmitter } from 'vscode'

import {
    type AccountKeyedChatHistory,
    type AuthCredentials,
    type AuthenticatedAuthStatus,
    type ChatHistoryKey,
    type ClientState,
    type DefaultsAndUserPreferencesForEndpoint,
    type ResolvedConfiguration,
    type UserLocalHistory,
    distinctUntilChanged,
    fromVSCodeEvent,
    startWith,
} from '@sourcegraph/cody-shared'
import { type Observable, map } from 'observable-fns'
import { secretStorage } from './SecretStorageProvider'

export type ChatLocation = 'editor' | 'sidebar'

class LocalStorage {
    protected readonly KEY_LOCAL_HISTORY = 'driver-local-chatHistory-v1'
    protected readonly KEY_WORKSPACE_HISTORY = 'driver-workspace-chatHistory-v1'
    protected readonly KEY_CONFIG = 'driver-config'
    protected readonly DRIVER_ENROLLMENT_HISTORY = 'driver-enrollments'
    protected readonly LAST_USED_CHAT_MODALITY = 'driver-last-used-chat-modality'
    public readonly ANONYMOUS_USER_ID_KEY = 'driverAnonymousUid'
    private readonly MODEL_PREFERENCES_KEY = 'driver-model-preferences'

    /**
     * Should be set on extension activation via `localStorage.setStorage(context.globalState)`
     * Done to avoid passing the local storage around as a parameter and instead
     * access it as a singleton via the module import.
     */
    private _storage: Memento | null = null
    private _workspaceStorage: Memento | null = null

    private get storage(): Memento {
        if (!this._storage) {
            throw new Error('LocalStorage not initialized')
        }

        return this._storage
    }

    private get workspaceStorage(): Memento {
        if (!this._workspaceStorage) {
            throw new Error('WorkspaceStorage not initialized')
        }
        return this._workspaceStorage
    }

    public setStorage(storage: ExtensionContext | Memento | 'noop' | 'inMemory'): void {
        if (storage === 'inMemory') {
            this._storage = inMemoryEphemeralLocalStorage
            this._workspaceStorage = inMemoryEphemeralLocalStorage
        } else if (storage === 'noop') {
            this._storage = noopLocalStorage
            this._workspaceStorage = noopLocalStorage
        } else if ('workspaceState' in storage) {
            // It's an ExtensionContext
            this._storage = storage.globalState
            this._workspaceStorage = storage.workspaceState
        } else {
            // It's a Memento
            this._storage = storage
            this._workspaceStorage = storage
        }
    }

    public getClientState(): ClientState {
        return {
            anonymousUserID: this.anonymousUserID(),
            lastUsedChatModality: this.getLastUsedChatModality(),
        }
    }

    private onChange = new EventEmitter<void>()
    public get clientStateChanges(): Observable<ClientState> {
        return fromVSCodeEvent(this.onChange.event).pipe(
            startWith(undefined),
            map(() => this.getClientState()),
            distinctUntilChanged()
        )
    }

    /**
     * Save the access token to secret storage.
     */
    public async saveEndpointAndToken(auth: Pick<AuthCredentials, 'credentials'>): Promise<void> {
        if (!auth.credentials) {
            return
        }

        if (auth.credentials && 'token' in auth.credentials) {
            await secretStorage.storeToken(auth.credentials.token, auth.credentials.source)
        }
        this.onChange.fire()
    }

    public getChatHistory(authStatus: Pick<AuthenticatedAuthStatus, 'user'>): UserLocalHistory {
        // Get workspace-specific history
        const workspaceHistory = this.workspaceStorage.get<AccountKeyedChatHistory | null>(
            this.KEY_WORKSPACE_HISTORY,
            null
        )
        const accountKey = getKeyForAuthStatus(authStatus)

        return workspaceHistory?.[accountKey] ?? { chat: {} }
    }

    public async setChatHistory(
        authStatus: Pick<AuthenticatedAuthStatus, 'user'>,
        history: UserLocalHistory
    ): Promise<void> {
        try {
            const key = getKeyForAuthStatus(authStatus)
            let workspaceHistory = this.workspaceStorage.get<AccountKeyedChatHistory | null>(
                this.KEY_WORKSPACE_HISTORY,
                null
            )

            if (workspaceHistory) {
                workspaceHistory[key] = history
            } else {
                workspaceHistory = {
                    [key]: history,
                }
            }

            await this.workspaceStorage.update(this.KEY_WORKSPACE_HISTORY, workspaceHistory)
        } catch (error) {
            console.error(error)
        }
    }

    public async importChatHistory(
        history: AccountKeyedChatHistory,
        shouldMerge: boolean
    ): Promise<void> {
        if (shouldMerge) {
            const workspaceHistory = this.workspaceStorage.get<AccountKeyedChatHistory | null>(
                this.KEY_WORKSPACE_HISTORY,
                null
            )
            merge(history, workspaceHistory)
        }

        await this.workspaceStorage.update(this.KEY_WORKSPACE_HISTORY, history)
    }

    public async deleteChatHistory(authStatus: AuthenticatedAuthStatus, chatID: string): Promise<void> {
        const userHistory = this.getChatHistory(authStatus)
        if (userHistory) {
            try {
                delete userHistory.chat[chatID]
                await this.setChatHistory(authStatus, userHistory)
            } catch (error) {
                console.error(error)
            }
        }
    }

    public async removeChatHistory(authStatus: AuthenticatedAuthStatus): Promise<void> {
        try {
            // Clear workspace history
            await this.workspaceStorage.update(this.KEY_WORKSPACE_HISTORY, null)

            // Also clear global history
            // const globalHistory = this.storage.get<AccountKeyedChatHistory | null>(this.KEY_LOCAL_HISTORY, null);
            // if (globalHistory) {
            //   const key = getKeyForAuthStatus(authStatus);
            //   delete globalHistory[key];
            //   await this.storage.update(this.KEY_LOCAL_HISTORY, globalHistory);
            // }
        } catch (error) {
            console.error(error)
        }
    }

    /**
     * Gets the enrollment history for a feature from the storage.
     *
     * Checks if the given feature name exists in the stored enrollment
     * history array.
     *
     * If not, add the feature to the memory, but return false after adding the feature
     * so that the caller can log the first enrollment event.
     */
    public getEnrollmentHistory(featureName: string): boolean {
        const history = this.storage.get<string[]>(this.DRIVER_ENROLLMENT_HISTORY, []) || []
        const hasEnrolled = history?.includes(featureName) || false
        // Log the first enrollment event
        if (!hasEnrolled) {
            history.push(featureName)
            this.set(this.DRIVER_ENROLLMENT_HISTORY, history)
        }
        return hasEnrolled
    }

    /**
     * Return the anonymous user ID stored in local storage or create one if none exists (which
     * occurs on a fresh installation). Callers can check
     * {@link LocalStorage.checkIfCreatedAnonymousUserID} to see if a new anonymous ID was created.
     */
    public anonymousUserID(): string {
        let id = this.storage.get<string>(this.ANONYMOUS_USER_ID_KEY)
        if (!id) {
            this.createdAnonymousUserID = true
            id = uuid.v4()
            this.set(this.ANONYMOUS_USER_ID_KEY, id).catch(error => console.error(error))
        }
        return id
    }

    private createdAnonymousUserID = false
    public checkIfCreatedAnonymousUserID(): boolean {
        if (this.createdAnonymousUserID) {
            this.createdAnonymousUserID = false
            return true
        }
        return false
    }

    public async setConfig(config: ResolvedConfiguration): Promise<void> {
        return this.set(this.KEY_CONFIG, config)
    }

    public getConfig(): ResolvedConfiguration | null {
        return this.get(this.KEY_CONFIG)
    }

    public setLastUsedChatModality(modality: 'sidebar' | 'editor'): void {
        this.set(this.LAST_USED_CHAT_MODALITY, modality)
    }

    public getLastUsedChatModality(): 'sidebar' | 'editor' {
        return this.get(this.LAST_USED_CHAT_MODALITY) ?? 'sidebar'
    }

    public getModelPreferences(): DefaultsAndUserPreferencesForEndpoint {
        return (
            this.get<DefaultsAndUserPreferencesForEndpoint>(this.MODEL_PREFERENCES_KEY) ?? {
                defaults: {},
                selected: {},
            }
        )
    }

    public async setModelPreferences(preferences: DefaultsAndUserPreferencesForEndpoint): Promise<void> {
        await this.set(this.MODEL_PREFERENCES_KEY, preferences)
    }

    public get<T>(key: string): T | null {
        return this.storage.get(key, null)
    }

    public async set<T>(key: string, value: T, fire = true): Promise<void> {
        try {
            await this.storage.update(key, value)
            if (fire) {
                this.onChange.fire()
            }
        } catch (error) {
            console.error(error)
        }
    }

    public async delete(key: string): Promise<void> {
        await this.storage.update(key, undefined)
        this.onChange.fire()
    }
}

/**
 * Singleton instance of the local storage provider.
 * The underlying storage is set on extension activation via `localStorage.setStorage(context.globalState)`.
 */
export const localStorage = new LocalStorage()

function getKeyForAuthStatus(authStatus: Pick<AuthenticatedAuthStatus, 'user'>): ChatHistoryKey {
    return `${authStatus.user.org_name}-${authStatus.user.userId}`
}

const noopLocalStorage = {
    get: () => null,
    update: () => Promise.resolve(undefined),
} as any as Memento

export function mockLocalStorage(storage: Memento | 'noop' | 'inMemory' = noopLocalStorage) {
    localStorage.setStorage(storage)
}

class InMemoryMemento implements Memento {
    private storage: Map<string, any> = new Map()

    get<T>(key: string, defaultValue: T): T
    get<T>(key: string): T | undefined
    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.storage.has(key) ? this.storage.get(key) : defaultValue
    }

    update(key: string, value: any): Thenable<void> {
        if (value === undefined) {
            this.storage.delete(key)
        } else {
            this.storage.set(key, value)
        }
        return Promise.resolve()
    }

    keys(): readonly string[] {
        return Array.from(this.storage.keys())
    }
}

const inMemoryEphemeralLocalStorage = new InMemoryMemento()
