import fs from 'fs-extra'
import path from 'path'
import os from 'os'

export async function findMcpConfigs() {
  const platform = process.platform
  const homeDir = os.homedir()

  let configPaths = []

  // Common paths across platforms
  configPaths.push(
    path.join(homeDir, '.cursor', 'mcp.json'),
    path.join(homeDir, '.vscode', 'mcp.json'),
    path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json')
  )

  // Platform-specific paths
  if (platform === 'darwin') {
    // macOS
    configPaths.push(
      path.join(
        homeDir,
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      ),
      path.join(
        homeDir,
        'Library',
        'Application Support',
        'Code',
        'User',
        'settings.json'
      )
    )
  } else if (platform === 'win32') {
    // Windows
    configPaths.push(
      path.join(
        homeDir,
        'AppData',
        'Roaming',
        'Claude',
        'claude_desktop_config.json'
      ),
      path.join(
        homeDir,
        'AppData',
        'Roaming',
        'Code',
        'User',
        'settings.json'
      )
    )
  } else if (platform === 'linux') {
    configPaths.push(
      path.join(homeDir, '.config', 'Code', 'User', 'settings.json')
    )
  }

  // Filter to only paths that exist
  const existingPaths = []

  for (const configPath of configPaths) {
    try {
      if (await fs.pathExists(configPath)) {
        try {
          // Try to read and parse the file to verify it's valid JSON
          const content = await fs.readFile(configPath, 'utf8')
          const json = JSON.parse(content)

          // Verify it contains MCP configuration
          if (
            (json.mcpServers &&
              Object.keys(json.mcpServers).length > 0) ||
            (json.mcp &&
              json.mcp.servers &&
              Object.keys(json.mcp.servers).length > 0) ||
            (json.servers && Object.keys(json.servers).length > 0)
          ) {
            existingPaths.push(configPath)
          }
        } catch {
          // Ignore files that aren't valid JSON or don't contain MCP config
        }
      }
    } catch {
      // Ignore errors checking file existence
    }
  }

  return existingPaths
}
