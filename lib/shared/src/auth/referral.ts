import { DriverIDE } from '../configuration'
import { clientCapabilities } from '../configuration/clientCapabilities'

/**
 * Returns a known referral code to use based on the current VS Code environment.
 * IMPORTANT: The code must be registered in the server-side referral code mapping:
 * @link client/web/src/user/settings/accessTokens/UserSettingsCreateAccessTokenCallbackPage.tsx
 * Use "DRIVER" as the default referral code for fallback.
 */
export function getDriverAuthReferralCode(uriScheme: string): string | undefined {
    const referralCodes: Partial<Record<DriverIDE, string>> = {
        [DriverIDE.JetBrains]: 'jetbrains',
        [DriverIDE.Neovim]: 'neovim',
        [DriverIDE.Emacs]: 'driver',
        [DriverIDE.VisualStudio]: 'visual_studio',
        [DriverIDE.Eclipse]: 'eclipse',
        [DriverIDE.VSCode]: 'vscode',
        [DriverIDE.Web]: 'driver',
    }

    if (clientCapabilities().agentIDE === DriverIDE.VSCode) {
        switch (uriScheme) {
            case 'vscode-insiders':
                return 'insiders'
            case 'vscodium':
                return 'vscodium'
            case 'cursor':
                return 'cursor'
        }
    }

    return referralCodes[clientCapabilities().agentIDE] || undefined
}
