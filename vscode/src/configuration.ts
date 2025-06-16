import * as vscode from 'vscode'

import type { ClientConfiguration, DriverIDE } from '@sourcegraph/cody-shared'

import { CONFIG_KEY, type ConfigKeys } from './configuration-keys'

interface ConfigGetter {
    get<T>(section: (typeof CONFIG_KEY)[ConfigKeys], defaultValue?: T): T
}

/**
 * All configuration values, with some sanitization performed.
 */
export function getConfiguration(
    config: ConfigGetter = vscode.workspace.getConfiguration()
): ClientConfiguration {
    function getHiddenSetting<T>(configKey: string, defaultValue?: T): T {
        return config.get<T>(`driver-ai.${configKey}` as any, defaultValue)
    }

    return {
        debugVerbose: config.get<boolean>(CONFIG_KEY.debugVerbose, false),
        codeActions: config.get(CONFIG_KEY.codeActionsEnabled, true),

        /**
         * Instance must have feature flag enabled to use this feature.
         */
        agenticContextExperimentalOptions: config.get(CONFIG_KEY.agenticContextExperimentalOptions, {}),

        /**
         * Hidden settings for internal use only.
         */

        internalDebugContext: getHiddenSetting('internal.debug.context', false),
        internalDebugState: getHiddenSetting('internal.debug.state', false),

        // hasNativeWebview: getHiddenSetting('advanced.hasNativeWebview', false),
        hasNativeWebview: true,
        agentIDE: getHiddenSetting<DriverIDE>('advanced.agent.ide.name'),

        /**
         * Overrides always take precedence over other configuration. Specific
         * override flags should be preferred over opaque blanket settings /
         * environment variables such as TESTING_MODE which can make it
         * difficult to understand the broad impact such a setting can have.
         */
        overrideAuthToken: getHiddenSetting<string | undefined>('override.authToken'),

        // DRIVER variables:

        /**
         * The base URL for the Driver API.
         */
        baseUrl: config.get<string>('driver-ai.apiUrl') || 'https://api.us1.driverai.com',
    }
}
