import { DriverIDE } from '@sourcegraph/cody-shared'
import {
    BookOpenText,
    BugIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ExternalLinkIcon,
    LogOutIcon,
    Settings2Icon,
    UserCircleIcon,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useUser } from '../contexts/UserContext'
import type { View } from '../tabs'
import { getVSCodeAPI } from '../utils/VSCodeApi'
import { UserAvatar } from './UserAvatar'
import { Command, CommandGroup, CommandItem, CommandLink, CommandList } from './shadcn/ui/command'
import { ToolbarPopoverItem } from './shadcn/ui/toolbar'
import { cn } from './shadcn/utils'

interface UserMenuProps {
    className?: string
    onCloseByEscape?: () => void
    setTabView: (tab: View) => void
}

type MenuView = 'main' | 'debug' | 'help'

export const UserMenu: React.FunctionComponent<UserMenuProps> = ({ className, onCloseByEscape }) => {
    const { IDE, user } = useUser()
    const { displayName, org_name, user_email } = user

    const [userMenuView, setUserMenuView] = useState<MenuView>('main')

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Escape') {
                onCloseByEscape?.()
            }
        },
        [onCloseByEscape]
    )

    const onMenuViewChange = useCallback((view: MenuView): void => {
        setUserMenuView(view)
    }, [])

    const onSignOutClick = useCallback((): void => {
        getVSCodeAPI().postMessage({
            command: 'auth',
            authKind: 'signout',
        })
        setUserMenuView('main')
    }, [])

    return (
        <ToolbarPopoverItem
            role="menu"
            iconEnd={null}
            className={cn('tw-justify-between tw-bg-inherit', className)}
            aria-label="Account Menu Button"
            popoverContent={close => (
                <Command
                    className="tw-shadow-lg tw-shadow-border-500/50 focus:tw-outline-none"
                    data-testid="user-dropdown-menu"
                >
                    {userMenuView === 'debug' ? (
                        <CommandList>
                            <CommandGroup title="Debug Menu">
                                <CommandItem onSelect={() => onMenuViewChange('main')}>
                                    <ChevronLeftIcon size={16} strokeWidth={1.25} className="tw-mr-2" />
                                    <span className="tw-flex-grow">Back</span>
                                </CommandItem>
                            </CommandGroup>
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        getVSCodeAPI().postMessage({
                                            command: 'command',
                                            id: 'driver-ai.debug.export.logs',
                                        })
                                        close()
                                    }}
                                >
                                    <span className="tw-flex-grow">Export Logs</span>
                                </CommandItem>

                                <CommandItem
                                    onSelect={() => {
                                        getVSCodeAPI().postMessage({
                                            command: 'command',
                                            id: 'driver-ai.debug.enable.all',
                                        })
                                        close()
                                    }}
                                >
                                    <span className="tw-flex-grow">Enable Debug Mode</span>
                                </CommandItem>

                                <CommandItem
                                    onSelect={() => {
                                        getVSCodeAPI().postMessage({
                                            command: 'command',
                                            id: 'driver-ai.debug.outputChannel',
                                        })
                                        close()
                                    }}
                                >
                                    <span className="tw-flex-grow">Open Output Channel</span>
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    ) : (
                        <CommandList>
                            <CommandGroup title="Main Account Menu">
                                <CommandItem>
                                    <div className="tw-flex tw-w-full tw-justify-start tw-gap-4 tw-align-middle tw-max-h-9">
                                        <UserAvatar
                                            size={USER_MENU_AVATAR_SIZE}
                                            className="tw-inline-flex tw-self-center tw-items-center tw-w-auto tw-flex-none tw-max-h-9"
                                        />
                                        <div className="tw-flex tw-self-stretch tw-flex-col tw-w-full tw-items-start tw-justify-center tw-flex-auto tw-overflow-hidden">
                                            <p
                                                className="tw-text-md tw-font-semibold tw-truncate tw-w-full"
                                                title={displayName}
                                            >
                                                {displayName}
                                            </p>
                                            <p
                                                className="tw-text-xs tw-text-muted-foreground tw-truncate tw-w-full"
                                                title={user_email}
                                            >
                                                {user_email}
                                            </p>
                                        </div>
                                        {/* <Badge
                      variant={'secondary'}
                      className="tw-opacity-85 tw-text-xs tw-h-fit tw-self-center tw-flex-shrink-0"
                      title={endpoint}
                    >
                      {userType}
                    </Badge> */}
                                    </div>
                                </CommandItem>
                            </CommandGroup>

                            <CommandGroup>
                                {org_name && (
                                    <CommandItem
                                        onSelect={() => {
                                            const url = `https://app.driverai.com/${org_name}/settings/account`
                                            getVSCodeAPI().postMessage({
                                                command: 'links',
                                                value: url,
                                            })
                                            close()
                                        }}
                                    >
                                        <UserCircleIcon
                                            size={16}
                                            strokeWidth={1.25}
                                            className="tw-mr-2"
                                        />
                                        <span className="tw-flex-grow">Manage Account</span>
                                        <ExternalLinkIcon size={16} strokeWidth={1.25} />
                                    </CommandItem>
                                )}

                                <CommandItem
                                    onSelect={() => {
                                        getVSCodeAPI().postMessage({
                                            command: 'command',
                                            id: 'driver-ai.status-bar.interacted',
                                        })
                                        close()
                                    }}
                                >
                                    <Settings2Icon size={16} strokeWidth={1.25} className="tw-mr-2" />
                                    <span className="tw-flex-grow">Extension Settings</span>
                                </CommandItem>
                            </CommandGroup>

                            <CommandGroup>
                                {IDE === DriverIDE.VSCode && (
                                    <CommandLink
                                        // TODO: (cd) Replace with new docs URL
                                        href="https://support.driver.ai/en/"
                                        target="_blank"
                                        rel="noreferrer"
                                        onSelect={() => {
                                            close()
                                        }}
                                    >
                                        <BookOpenText size={16} strokeWidth={1.25} className="tw-mr-2" />
                                        <span className="tw-flex-grow">Getting Started Guide</span>
                                        <ExternalLinkIcon size={16} strokeWidth={1.25} />
                                    </CommandLink>
                                )}

                                {IDE === DriverIDE.VSCode && (
                                    <CommandItem
                                        onSelect={() => {
                                            getVSCodeAPI().postMessage({
                                                command: 'command',
                                                id: 'driver-ai.debug.reportIssue',
                                            })
                                            close()
                                        }}
                                    >
                                        <span className="tw-flex-grow">Report Issue</span>
                                    </CommandItem>
                                )}

                                {IDE === DriverIDE.VSCode && (
                                    <CommandItem onSelect={() => onMenuViewChange('debug')}>
                                        <BugIcon size={16} strokeWidth={1.25} className="tw-mr-2" />
                                        <span className="tw-flex-grow">Debug</span>
                                        <ChevronRightIcon size={16} strokeWidth={1.25} />
                                    </CommandItem>
                                )}

                                {/* <CommandItem onSelect={() => onMenuViewChange('help')}>
                  <CircleHelpIcon size={16} strokeWidth={1.25} className="tw-mr-2" />
                  <span className="tw-flex-grow">Help</span>
                  <ChevronRightIcon size={16} strokeWidth={1.25} />
                </CommandItem> */}
                            </CommandGroup>

                            <CommandGroup>
                                <CommandItem onSelect={() => onSignOutClick()}>
                                    <LogOutIcon size={16} strokeWidth={1.25} className="tw-mr-2" />
                                    <span className="tw-flex-grow">Sign Out</span>
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    )}
                </Command>
            )}
            // popoverRootProps={{ onOpenChange }}
            popoverContentProps={{
                className: '!tw-p-2 tw-mr-6',
                onKeyDown: onKeyDown,
                onCloseAutoFocus: event => {
                    event.preventDefault()
                },
            }}
        >
            <UserAvatar size={USER_MENU_AVATAR_SIZE} className="tw-max-h-full tw-width-auto" />
        </ToolbarPopoverItem>
    )
}

const USER_MENU_AVATAR_SIZE = 16
