import type { AuthError } from '../sourcegraph-api/errors'

/**
 * The authentication status, which includes representing the state when authentication failed or
 * has not yet been attempted.
 */
export type AuthStatus = UnauthenticatedAuthStatus | AuthenticatedAuthStatus

export interface User {
    avatar_url?: string
    org_display_name?: string
    org_id?: string
    org_name?: string
    user_email?: string
    user_full_name?: string
    userId?: string
}

/**
 * The authentication status for a user who has successfully authenticated.
 */
export interface AuthenticatedAuthStatus {
    authenticated: true
    user: User

    pendingValidation: boolean
}

/**
 * The authentication status for a user who has not yet authenticated or for whom authentication
 * failed.
 */
export interface UnauthenticatedAuthStatus {
    authenticated: false
    error?: AuthError

    pendingValidation: boolean
}
