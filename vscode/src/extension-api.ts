import type { ExtensionMode } from 'vscode'
import { TestSupport } from './test-support'

// The API surface exported to other extensions.
export class ExtensionApi {
    // Hooks for extension test support. This is only set if the
    // environment contains DRIVER_TESTING=true . This is only for
    // testing and the API will change.
    public testing: TestSupport | undefined = undefined

    constructor(public extensionMode: ExtensionMode) {
        if (process.env.DRIVER_TESTING === 'true') {
            console.warn('Setting up testing hooks')
            this.testing = new TestSupport()
            TestSupport.instance = this.testing
        }
    }
}
