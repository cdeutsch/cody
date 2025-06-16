import { type ReactNode, createContext, useContext } from 'react'

import { DriverIDE, type User } from '@sourcegraph/cody-shared'

export interface UserExtra extends User {
    displayName: string
}

export interface UserContextType {
    user: UserExtra
    IDE: DriverIDE
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export interface UserProviderProps {
    children: ReactNode
    user: User
}

export function UserProvider({ children, user }: UserProviderProps) {
    return (
        <UserContext.Provider
            value={{
                user: {
                    ...user,
                    displayName: user.user_full_name || user.user_email || '',
                },
                // Future: support other IDEs?
                IDE: DriverIDE.VSCode,
            }}
        >
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error('useUser must be used within an UserProvider')
    }
    return context
}
