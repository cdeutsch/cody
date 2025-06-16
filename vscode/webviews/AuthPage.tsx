import { ArrowRightIcon, LogInIcon } from 'lucide-react'

import { Button } from './components/shadcn/ui/button'

export interface LoginProps {
    onLogin: () => void
}

/**
 * A component that shows the available ways for the user to sign in or sign up.
 */
export const AuthPage: React.FunctionComponent<React.PropsWithoutRef<LoginProps>> = ({ onLogin }) => {
    return (
        <div className="tw-flex tw-flex-col tw-w-full tw-h-full tw-p-10 tw-items-center">
            <div className="tw-w-full tw-max-w-md tw-flex-1 tw-px-6 tw-flex-col tw-items-center tw-gap-8">
                {/* Header section */}
                <div className="tw-w-full tw-flex tw-justify-start tw-mt-8 tw-mb-[10%]">
                    <LogInIcon className="tw-w-auto tw-h-auto tw-p-4 tw-border tw-text-keybinding-foreground tw-border-muted-foreground tw-bg-keybinding-background tw-rounded-md" />
                    <div className="tw-ml-4">
                        <div className="tw-font-semibold tw-text-lg">Sign in to Driver</div>
                        <div className="tw-text-muted-foreground tw-text-sm">
                            Let&apos;s get you started
                        </div>
                    </div>
                </div>
                <div>
                    {/* Free/Pro section */}
                    <section className="tw-bg-sidebar-background tw-text-sidebar-foreground tw-w-full tw-max-w-md tw-mt-8">
                        <div className="tw-flex tw-flex-col tw-gap-6 tw-w-full">
                            <Button
                                className="tw-flex tw-justify-between !tw-p-4"
                                onClick={onLogin}
                                title="Sign in with Driver"
                            >
                                <span className="tw-font-semibold">Continue</span>
                                <ArrowRightIcon size={16} />
                            </Button>
                        </div>
                    </section>
                </div>
            </div>
            <footer className="tw-text-sm tw-text-muted-foreground">
                By signing in to Driver, you agree to our{' '}
                <a target="_blank" rel="noopener noreferrer" href="https://www.driver.ai/terms-of-use">
                    Terms of Service
                </a>{' '}
                and{' '}
                <a target="_blank" rel="noopener noreferrer" href="https://www.driver.ai/privacy-policy">
                    Privacy Policy
                </a>
                .
            </footer>
        </div>
    )
}
