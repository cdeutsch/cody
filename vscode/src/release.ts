import { DriverIDE } from '@sourcegraph/cody-shared'

type ReleaseType = 'stable' | 'insiders'

const majorVersion = (version: string): string => version.split('.')[0]

const minorVersion = (version: string): string => version.split('.')[1]

export const majorMinorVersion = (version: string): string =>
    [majorVersion(version), minorVersion(version)].join('.')

/**
 * Determines the release type (stable or insiders) for the given IDE and version.
 *
 * @param IDE - The IDE to get the release type for.
 * @param version - The version of the IDE.
 * @returns The release type ('stable' or 'insiders') for the given IDE and version.
 */
export function getReleaseTypeByIDE(IDE: DriverIDE, version: string): ReleaseType {
    switch (IDE) {
        case DriverIDE.VSCode:
            return Number(minorVersion(version)) % 2 === 1 ? 'insiders' : 'stable'

        case DriverIDE.JetBrains:
            return version.endsWith('-nightly') ? 'insiders' : 'stable'

        // Add new IDEs here

        default:
            throw new Error('IDE not supported')
    }
}
