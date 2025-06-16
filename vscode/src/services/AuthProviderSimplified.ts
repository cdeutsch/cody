import { getDriverAuthReferralCode } from '@sourcegraph/cody-shared'
import * as vscode from 'vscode'

// An auth provider for simplified onboarding. This is a sidecar to AuthProvider
// so we can deprecate the experiment later. AuthProviderSimplified only works
// for dotcom, and doesn't work on VScode web. See LoginSimplified.

export class AuthProviderSimplified {
    public async openExternalAuthUrl(tokenReceiverUrl?: string): Promise<boolean> {
        if (!(await openExternalAuthUrl(tokenReceiverUrl))) {
            return false
        }
        // authProvider.setAuthPendingToEndpoint(DOTCOM_URL.toString());
        return true
    }
}

// Opens authentication URLs for simplified onboarding.
function openExternalAuthUrl(tokenReceiverUrl?: string): Thenable<boolean> {
    // Create the chain of redirects:
    // 1. Specific login page (GitHub, etc.) redirects to the new token page
    // 2. New token page redirects back to the extension with the new token
    const referralCode = getDriverAuthReferralCode(vscode.env.uriScheme)
    const tokenReceiver = tokenReceiverUrl ? `?tokenReceiverUrl=${tokenReceiverUrl}` : ''
    const redirect = encodeURIComponent(`${tokenReceiver}`)
    const config = vscode.workspace.getConfiguration()
    const actualBaseUrl = config.get<string>('driver-ai.appUrl') || 'https://app.driverai.com'
    const uriSpec = `${actualBaseUrl}/ide/auth/${referralCode}${redirect}`

    // VScode Uri handling escapes ?, = in the redirect parameter. dotcom's
    // redirectTo handling does not unescape these. As a result we route
    // /post-sign-up%3F... as a search. Work around VScode's Uri handling
    // by passing a string which gets passed through to a string|Uri parameter
    // anyway.

    // FIXME: Pass a Uri here when dotcom redirectTo handling applies one level
    // of unescaping to the parameter, or we special case the routing for
    // /post-sign-up%3F...
    return vscode.env.openExternal(uriSpec as unknown as vscode.Uri)
}
