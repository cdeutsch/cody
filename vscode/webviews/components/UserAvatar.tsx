import { clsx } from 'clsx'
import { useState } from 'react'
import type { FunctionComponent } from 'react'

import { useUser } from '../contexts/UserContext'

import styles from './UserAvatar.module.css'

interface UserAvatarProps {
    size: number
    className?: string
}

export const UserAvatar: FunctionComponent<UserAvatarProps> = ({ size, className }) => {
    const { user } = useUser()
    const { displayName } = user
    const highDPISize = size * 2
    const [imgError, setImgError] = useState(false)

    if (user?.avatar_url && !imgError) {
        let url = user.avatar_url
        try {
            const urlObject = new URL(user.avatar_url)
            // Add a size param for non-data URLs. This will resize the image if it is hosted on
            // certain places like Gravatar and GitHub.
            if (size && !user.avatar_url.startsWith('data:')) {
                urlObject.searchParams.set('s', highDPISize.toString())
            }
            url = urlObject.href
        } catch {
            // noop
        }

        return (
            <img
                className={clsx(styles.userAvatar, className)}
                src={url}
                role="presentation"
                title={displayName}
                alt={`Avatar for ${displayName}`}
                width={size}
                height={size}
                onError={() => setImgError(true)}
            />
        )
    }
    return (
        <div
            title={displayName}
            className={clsx(styles.userAvatar, className)}
            style={{ width: `${size}px`, height: `${size}px`, fontSize: `${size / 2.25}px` }}
        >
            <span className={styles.initials}>{getInitials(displayName || '')}</span>
        </div>
    )
}

function getInitials(fullName: string): string {
    const names = fullName.split(' ')
    const initials = names.map(name => name.charAt(0).toUpperCase())
    if (initials.length > 1) {
        return `${initials[0]}${initials.at(-1)}`
    }
    return initials[0]
}
