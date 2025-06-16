import { describe, expect, it } from 'vitest'

import { DriverIDE } from '@sourcegraph/cody-shared'
import { getReleaseTypeByIDE, majorMinorVersion } from './release'

describe('majorMinorVersion', () => {
    it('returns the first two components', () => {
        expect(majorMinorVersion('0.2.1')).toEqual('0.2')
        expect(majorMinorVersion('4.2.1')).toEqual('4.2')
        expect(majorMinorVersion('4.3.1689391131')).toEqual('4.3')
    })
})

describe('getReleaseTypeByIDE', () => {
    it('returns insiders for VS Code versions with odd minor version', () => {
        expect(getReleaseTypeByIDE(DriverIDE.VSCode, '4.3.1')).toEqual('insiders')
        expect(getReleaseTypeByIDE(DriverIDE.VSCode, '4.5.0')).toEqual('insiders')
        expect(getReleaseTypeByIDE(DriverIDE.VSCode, '4.3.1689391131')).toEqual('insiders')
    })

    it('returns stable for VS Code versions with even minor version', () => {
        expect(getReleaseTypeByIDE(DriverIDE.VSCode, '4.2.1')).toEqual('stable')
        expect(getReleaseTypeByIDE(DriverIDE.VSCode, '4.4.0')).toEqual('stable')
    })

    it('returns insiders for JetBrains versions ending with -nightly', () => {
        expect(getReleaseTypeByIDE(DriverIDE.JetBrains, '2023.1.1-nightly')).toEqual('insiders')
        expect(getReleaseTypeByIDE(DriverIDE.JetBrains, '2023.2.0-nightly')).toEqual('insiders')
    })

    it('returns stable for JetBrains versions not ending with -nightly', () => {
        expect(getReleaseTypeByIDE(DriverIDE.JetBrains, '2023.1.1')).toEqual('stable')
        expect(getReleaseTypeByIDE(DriverIDE.JetBrains, '2023.2.0')).toEqual('stable')
    })

    it('throws an error for unsupported IDEs', () => {
        expect(() => getReleaseTypeByIDE('SublimeText' as DriverIDE, '4.0.0')).toThrowError(
            'IDE not supported'
        )
    })
})
