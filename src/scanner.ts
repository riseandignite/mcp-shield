import fs from 'fs-extra'
import {getTools} from './utils/server-connectors.js'
import {
  detectHiddenInstructions,
  detectExfiltrationChannels,
  detectToolShadowing,
  detectSensitiveFileAccess,
  detectCrossOriginViolations,
} from './analyzers/tool-analyzer.js'
import {analyzeWithClaude} from './analyzers/claude-analyzer.js'
import path from 'path'
import {
  ScanProgressCallback,
  ScanResult,
  Vulnerability,
  CrossRefMatch,
  ClaudeAnalysis,
} from './types.js'

export async function scanMcpServer(
  configPath: string,
  progressCallback: ScanProgressCallback,
  claudeApiKey?: string,
  identifyAs?: string,
  safeList?: string[]
): Promise<ScanResult> {
  const result: ScanResult = {
    serverName: path.basename(path.dirname(configPath)),
    configPath,
    crossOriginViolation: false,
    vulnerabilities: [],
  }

  let configData: any
  try {
    configData = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error: any) {
    throw new Error(
      `Failed to read or parse config file "${configPath}": ${error.message}`
    )
  }

  // Extract MCP servers from config data (handle different formats)
  let mcpServers: Record<string, any> | null = null
  if (configData.mcpServers) {
    mcpServers = configData.mcpServers // Claude Desktop format
  } else if (configData.mcp && configData.mcp.servers) {
    mcpServers = configData.mcp.servers // VS Code format
  } else if (configData.servers) {
    mcpServers = configData.servers // Generic format
  }

  if (!mcpServers) {
    throw new Error(`No MCP servers found in ${configPath}`)
  }

  // Check each server
  const serversWithTools: Record<string, any[]> = {}

  for (const [serverName, serverConfig] of Object.entries(
    mcpServers
  )) {
    // Skip servers in the safe list
    if (safeList && safeList.includes(serverName)) {
      progressCallback({
        type: 'server-skipped',
        serverName,
        reason: 'In safe list',
      })
      continue
    }

    try {
      // Get tools from server
      const tools = await getTools(serverConfig, identifyAs)

      serversWithTools[serverName] = tools

      // Emit server connected event

      progressCallback({
        type: 'server-connected',
        serverName,
        toolCount: tools.length,
        tools,
      })

      // Analyze each tool
      for (const tool of tools) {
        progressCallback({
          type: 'tool-scanning',
          serverName,
          toolName: tool.name,
        })

        const hiddenInstructionsResult = detectHiddenInstructions(
          tool.description
        )
        const exfiltrationChannelsResult = detectExfiltrationChannels(
          tool.inputSchema
        )
        const shadowingResult = detectToolShadowing(tool.description)
        const sensitiveFileAccessResult = detectSensitiveFileAccess(
          tool.description
        )

        const hasHiddenInstructions =
          hiddenInstructionsResult.detected
        const hasExfiltrationChannels =
          exfiltrationChannelsResult.detected
        const hasShadowing = shadowingResult.detected
        const accessesSensitiveFiles =
          sensitiveFileAccessResult.detected

        // Collect all detected pattern matches
        const detectionDetails = {
          hiddenInstructions: hiddenInstructionsResult.matches || [],
          exfiltrationChannels:
            exfiltrationChannelsResult.matches || [],
          shadowing: shadowingResult.matches || [],
          sensitiveFileAccess:
            sensitiveFileAccessResult.matches || [],
        }

        // Calculate the issues detected
        const issuesDetected = [
          hasHiddenInstructions && 'hidden-instructions',
          hasExfiltrationChannels && 'exfiltration-channels',
          hasShadowing && 'tool-shadowing',
          accessesSensitiveFiles && 'sensitive-file-access',
        ].filter(Boolean) as string[]

        const severity =
          hasShadowing || accessesSensitiveFiles ? 'HIGH' : 'MEDIUM'

        progressCallback({
          type: 'tool-analyzed',
          serverName,
          toolName: tool.name,
          hasIssues: issuesDetected.length > 0,
          issues: issuesDetected,
          severity: severity,
        })

        // If any check fails, add a vulnerability
        if (
          hasHiddenInstructions ||
          hasExfiltrationChannels ||
          hasShadowing ||
          accessesSensitiveFiles
        ) {
          let details = []
          if (hasHiddenInstructions)
            details.push('Contains hidden instructions')
          if (hasExfiltrationChannels)
            details.push('Contains potential exfiltration channels')
          if (hasShadowing)
            details.push(
              'May shadow or modify behavior of other tools'
            )
          if (accessesSensitiveFiles)
            details.push('Attempts to access sensitive files')

          // Optionally use Claude for enhanced analysis
          let claudeAnalysis: ClaudeAnalysis | undefined
          if (
            claudeApiKey &&
            (hasHiddenInstructions ||
              hasShadowing ||
              accessesSensitiveFiles) &&
            tool.description
          ) {
            claudeAnalysis = await analyzeWithClaude(
              tool.description,
              claudeApiKey
            )
          }

          const vulnerability: Vulnerability = {
            severity,
            server: serverName,
            tool: tool.name,

            claudeAnalysis,
            detectionDetails,
          }

          result.vulnerabilities.push(vulnerability)
        }
      }
    } catch (error: any) {
      progressCallback({
        type: 'server-error',
        serverName,
        error: error.message,
      })
    }
  }

  // Check cross-references between servers
  if (Object.keys(serversWithTools).length > 1) {
    progressCallback({
      type: 'cross-origin-check',
    })

    const crossRefSources = new Set()
    const crossRefMatches: CrossRefMatch[] = []

    for (const [serverName, tools] of Object.entries(
      serversWithTools
    )) {
      const otherServerNames = Object.keys(serversWithTools).filter(
        (name) => name !== serverName
      )

      for (const tool of tools) {
        if (!tool.description) continue

        const crossOriginResult = detectCrossOriginViolations(
          tool.description,
          otherServerNames,
          serverName,
          safeList
        )

        if (crossOriginResult.detected) {
          result.crossOriginViolation = true
          crossOriginResult.matches.forEach((match) => {
            crossRefSources.add(match.referencedServer)
            crossRefMatches.push({
              server: serverName,
              tool: tool.name,
              referencedName: match.referencedServer!,
              context: match.context,
            })
          })
        }
      }
    }

    if (crossRefMatches.length > 0) {
      const vulnerability: Vulnerability = {
        severity: 'MEDIUM',
        server: Array.from(crossRefSources).join(', '),

        crossRefMatches,
      }
      result.vulnerabilities.push(vulnerability)
    }
  }

  return result
}
