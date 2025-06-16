import type React from 'react'
import { useCallback, useState } from 'react'
import { CheckCodeBlockIcon, CopyCodeBlockIcon } from '../../icons/CodeBlockActionIcons'
import type { CodeBlockActionsProps } from './ChatMessageContent'
import styles from './ChatMessageContent.module.css'

export const CopyButton = ({
    text,
    onCopy,
    className = styles.button,
    showLabel = true,
    title = 'Copy Code',
    label = 'Copy',
    icon: customIcon,
}: {
    text: string
    onCopy?: CodeBlockActionsProps['copyButtonOnSubmit']
    className?: string
    showLabel?: boolean
    title?: string
    label?: string
    icon?: JSX.Element
}): React.ReactElement => {
    const [currentLabel, setCurrentLabel] = useState(label)
    const [icon, setIcon] = useState<JSX.Element>(customIcon || CopyCodeBlockIcon)

    const handleClick = useCallback(() => {
        setIcon(CheckCodeBlockIcon)
        setCurrentLabel('Copied')
        navigator.clipboard.writeText(text).catch(error => console.error(error))
        if (onCopy) {
            onCopy(text, 'Button')
        }

        setTimeout(() => {
            setIcon(customIcon || CopyCodeBlockIcon)
            setCurrentLabel(label)
        }, 5000)
    }, [onCopy, text, label, customIcon])

    return (
        <button type="button" className={className} onClick={handleClick} title={title}>
            <div className={styles.iconContainer}>{icon}</div>
            {showLabel && <span className="tw-hidden xs:tw-block">{currentLabel}</span>}
        </button>
    )
}
