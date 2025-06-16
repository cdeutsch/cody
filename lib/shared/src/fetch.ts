/**
 * By hard-requiring isomorphic-fetch, we ensure that even in newer Node environments that include
 * `fetch` by default, we still use the `node-fetch` polyfill and have access to the networking code
 */
import isomorphicFetch from 'isomorphic-fetch'
import { globalAgentRef } from './fetch.patch'
import { addDriverClientIdentificationHeaders } from './sourcegraph-api/client-name-version'
import type { BrowserOrNodeResponse } from './sourcegraph-api/graphql/client-types'
export * from './fetch.patch'

export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<BrowserOrNodeResponse> {
    init = init ?? {}
    const headers = new Headers(init?.headers)
    addDriverClientIdentificationHeaders(headers)
    init.headers = headers

    const initWithAgent: RequestInit & { agent: typeof globalAgentRef.agent } = {
        ...init,
        agent: globalAgentRef.agent,
    }
    return isomorphicFetch(input, initWithAgent)
}
