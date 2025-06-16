import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

export function isLocation(value: any): value is vscode.Location {
    return 'uri' in value
}

export function isUri(value: any): value is vscode.Uri {
    return 'scheme' in value
}

// Function to get git repository name
export async function getGitRepositoryName(): Promise<string | undefined> {
    if (!vscode.workspace.workspaceFolders) {
        return undefined
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath
    const gitConfigPath = path.join(workspaceRoot, '.git', 'config')

    try {
        if (fs.existsSync(gitConfigPath)) {
            const configContent = fs.readFileSync(gitConfigPath, 'utf8')
            const urlMatch = configContent.match(/url\s*=\s*(.+)/)
            if (urlMatch) {
                const url = urlMatch[1]
                // Extract repository name from URL
                const repoName = url.split('/').pop()?.replace('.git', '')
                return repoName
            }
        }
    } catch (error) {
        console.error('Error reading git config:', error)
    }

    return undefined
}
