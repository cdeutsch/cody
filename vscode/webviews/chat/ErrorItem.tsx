import type React from 'react'

import { type ChatError, RateLimitError } from '@sourcegraph/cody-shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/shadcn/ui/tooltip'
import type {
    HumanMessageInitialContextInfo as InitialContextInfo,
    PriorHumanMessageInfo,
} from './cells/messageCell/assistant/AssistantMessageCell'

import type { ApiPostMessage } from '../Chat'

import { Button } from '../components/shadcn/ui/button'
import styles from './ErrorItem.module.css'

/**
 * An error message shown in the chat.
 */
export const ErrorItem: React.FunctionComponent<{
    error: Omit<ChatError, 'isChatErrorGuard'>
    postMessage?: ApiPostMessage
    humanMessage?: PriorHumanMessageInfo | null
}> = ({ error, postMessage, humanMessage }) => {
    if (typeof error !== 'string' && error.name === RateLimitError.errorName && postMessage) {
        return <RateLimitErrorItem error={error as RateLimitError} />
    }
    return <RequestErrorItem error={error} humanMessage={humanMessage} />
}

/**
 * Renders a generic error message for chat request failures.
 */
export const RequestErrorItem: React.FunctionComponent<{
    error: Error
    humanMessage?: PriorHumanMessageInfo | null
}> = ({ error, humanMessage }) => {
    const isApiVersionError = error.message.includes('unable to determine Driver API version')

    const actions =
        isApiVersionError && humanMessage
            ? [
                  {
                      label: 'Try again',
                      tooltip: 'Retry request without code context',
                      onClick: () => {
                          const options: InitialContextInfo = {
                              repositories: false,
                              files: false,
                          }
                          humanMessage.rerunWithDifferentContext(options)
                      },
                  },
              ]
            : []

    return (
        <div className={styles.requestError}>
            <div className={styles.errorContent}>
                <span className={styles.requestErrorTitle}>Request Failed: </span>
                {error.message}
            </div>
            {actions.length > 0 && (
                <menu className="tw-flex tw-gap-2 tw-text-sm tw-text-muted-foreground">
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-2">
                        <ul className="tw-whitespace-nowrap tw-flex tw-gap-2 tw-flex-wrap">
                            {actions.map(({ label, tooltip, onClick }) => (
                                <li key={label}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={onClick}>
                                                {label}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{tooltip}</TooltipContent>
                                    </Tooltip>
                                </li>
                            ))}
                        </ul>
                    </div>
                </menu>
            )}
        </div>
    )
}
/**
 * An error message shown in the chat.
 */
const RateLimitErrorItem: React.FunctionComponent<{
    error: RateLimitError
}> = ({ error }) => {
    return (
        <div className={styles.errorItem}>
            <div className={styles.body}>
                <header>
                    <h1>Rate Limit Exceeded</h1>
                    <p>{error.userMessage}</p>
                </header>

                {error.retryMessage && <p className={styles.retryMessage}>{error.retryMessage}</p>}
            </div>
        </div>
    )
}
