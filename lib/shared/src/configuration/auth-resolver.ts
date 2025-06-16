import { Subject } from 'observable-fns'

import type { AuthCredentials, ClientConfiguration } from '../configuration'
import type { ClientSecrets } from './resolver'

export const externalAuthRefresh = new Subject<void>()

async function createTokenCredentials(clientSecrets: ClientSecrets): Promise<AuthCredentials> {
    const token = await clientSecrets.getToken().catch(error => {
        throw new Error(`Failed to get access token: ${error.message || error}`)
    })

    return {
        credentials: token ? { token, source: await clientSecrets.getTokenSource() } : undefined,
    }
}

export async function resolveAuth(
    configuration: Pick<ClientConfiguration, 'overrideAuthToken'>,
    clientSecrets: ClientSecrets
): Promise<AuthCredentials> {
    const { overrideAuthToken } = configuration

    try {
        if (overrideAuthToken) {
            return { credentials: { token: overrideAuthToken } }
        }

        return createTokenCredentials(clientSecrets)
    } catch (error) {
        return {
            credentials: undefined,
            error,
        }
    }
}
