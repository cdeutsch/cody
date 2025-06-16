// cspell:ignore cenv
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import type { AuthCredentials } from './configuration'
import { currentResolvedConfig } from './configuration/resolver'
import { logDebug } from './logger'

// Interface for API initialization
export interface ApiInitializationOptions {
    baseUrl: string
}

// Global API instance
let api: AxiosInstance | null = null
let baseApiUrl: string | null = null

// Function to initialize the global API instance
export function initializeGlobalApi(options: ApiInitializationOptions): AxiosInstance {
    baseApiUrl = `${options.baseUrl}/api/v1`
    logDebug('api-axios', 'baseApiUrl', baseApiUrl)

    api = axios.create({
        baseURL: baseApiUrl,
        headers: {
            'Content-Type': 'application/json',
        },
        // Our backend expects query params to only exist once and be comma-separated, so we need to serialize them this way.
        paramsSerializer: params => {
            const searchParams = new URLSearchParams()
            for (const key in params) {
                if (Array.isArray(params[key])) {
                    searchParams.append(key, params[key].join(','))
                } else {
                    if (params[key] !== undefined) {
                        searchParams.append(key, params[key])
                    }
                }
            }
            return searchParams.toString()
        },
    })

    // Add request interceptor for authentication
    api.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
            try {
                const headers = await getAuthHeadersForCurrentConfig()
                for (const [key, value] of Object.entries(headers || {})) {
                    config.headers[key] = value
                }
                return config
            } catch (error: any) {
                throw new Error('Authentication required', { cause: error })
            }
        },
        (error: AxiosError) => {
            return Promise.reject(error)
        }
    )

    return api
}

// Function to get the global API instance
export function getGlobalApi(): AxiosInstance {
    if (!api) {
        throw new Error('Global API instance not initialized. Call initializeGlobalApi() first.')
    }
    return api
}

export function getBaseApiUrl(): string {
    if (!baseApiUrl) {
        throw new Error('Base API URL not initialized. Call initializeGlobalApi() first.')
    }
    return baseApiUrl
}

// Function to check if global API is initialized
export function isGlobalApiInitialized(): boolean {
    return api !== null
}

export function getAuthHeadersForToken(token: string): Record<string, string> {
    return { 'X-API-Key': token }
}

export async function getAuthHeaders(
    auth: AuthCredentials
): Promise<Record<string, string> | undefined> {
    if (auth.credentials) {
        if ('token' in auth.credentials) {
            return getAuthHeadersForToken(auth.credentials.token)
        }
        if (typeof auth.credentials.getHeaders === 'function') {
            return await auth.credentials.getHeaders()
        }
    }

    return undefined
}

export async function getAuthHeadersForCurrentConfig(): Promise<Record<string, string> | undefined> {
    const { auth } = await currentResolvedConfig()

    return getAuthHeaders(auth)
}
