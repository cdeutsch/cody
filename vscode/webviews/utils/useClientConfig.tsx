import type { ClientConfig } from '@sourcegraph/cody-shared'
import {
    type ComponentProps,
    type FunctionComponent,
    type ReactNode,
    createContext,
    useContext,
} from 'react'

const ClientConfigContext = createContext<ClientConfig | null>(null)

/**
 * React context provider whose `value` is the {@link ClientConfig}.
 */
export const ClientConfigProvider: FunctionComponent<{
    value: ComponentProps<(typeof ClientConfigContext)['Provider']>['value']
    children: ReactNode
}> = ({ value, children }) => (
    <ClientConfigContext.Provider value={value}>{children}</ClientConfigContext.Provider>
)

/**
 * React hook for getting the {@link ClientConfig}.
 */
export function useClientConfig(): ClientConfig | null {
    return useContext(ClientConfigContext)
}
