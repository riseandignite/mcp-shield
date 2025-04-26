#!/usr/bin/env node

import {Command} from 'commander'
import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import logSymbols from 'log-symbols'
import boxen from 'boxen'
import {fileURLToPath} from 'url'

import {scanMcpServer} from './scanner.js'
import {findMcpConfigs} from './utils/config-finder.js'
import {Tree} from './utils/tree-renderer.js'
import {ScanProgressCallback, ScanResult, Severity} from './types.js'

// Get package info
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.join(__dirname, '../package.json')
const packageJson = JSON.parse(
  fs.readFileSync(packageJsonPath, 'utf8')
)

// Setup CLI
const program = new Command()

const getRiskLevel = (severity: Severity, message?: string) => {
  return severity === 'HIGH'
    ? chalk.red(message || severity)
    : severity === 'MEDIUM'
    ? chalk.yellow(message || severity)
    : severity === 'LOW'
    ? chalk.blue(message || severity)
    : message || severity
}

// Create progress-tracking scanner display with tree view
async function scanWithTreeDisplay(
  configPath: string,
  claudeApiKey?: string,
  identifyAs?: string,
  safeList?: string[]
) {
  console.log(chalk.bold(`Scanning "${configPath}"`))

  const tree = new Tree()

  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    let mcpServers = null

    if (configData.mcpServers) {
      mcpServers = configData.mcpServers
    } else if (configData.mcp && configData.mcp.servers) {
      mcpServers = configData.mcp.servers
    } else if (configData.servers) {
      mcpServers = configData.servers
    }

    if (!mcpServers) {
      console.log(
        chalk.yellow(`No MCP servers found in ${configPath}`)
      )
      return
    }

    const outputNode = tree.addRoot(
      `Found ${Object.keys(mcpServers).length} servers:`
    )

    // Setup initial server nodes in the tree (all pending)
    const serverNodes = new Map()
    const toolNodes = new Map()

    for (const serverName of Object.keys(mcpServers)) {
      const serverNode = tree.addChild(
        outputNode,
        `○ ${chalk.bold(serverName)} connecting...`
      )
      serverNodes.set(serverName, serverNode)
    }

    // Define progress callback for scanner
    const progressCallback: ScanProgressCallback = (event) => {
      let needsRender = true

      if (event.type === 'server-connected') {
        const serverNode = serverNodes.get(event.serverName)
        if (serverNode) {
          serverNode.update(
            `● ${chalk.bold(event.serverName)} (${
              event.toolCount
            } tool${event.toolCount > 1 ? 's' : ''})`
          )

          // Add tool nodes for each tool (initially pending)
          event.tools.forEach((tool) => {
            const toolNode = tree.addChild(
              serverNode,
              `○ ${chalk.bold(tool.name)} — scanning...`
            )
            toolNodes.set(
              `${event.serverName}.${tool.name}`,
              toolNode
            )
          })
        }
      } else if (event.type === 'server-error') {
        const serverNode = serverNodes.get(event.serverName)
        if (serverNode) {
          serverNode.update(
            `✗ ${chalk.bold(event.serverName)} — ${chalk.red(
              event.error
            )}`
          )
        }
      } else if (event.type === 'server-skipped') {
        const serverNode = serverNodes.get(event.serverName)
        if (serverNode) {
          serverNode.update(
            `○ ${chalk.bold(event.serverName)} — ${chalk.blue(
              'Skipped'
            )} (${event.reason})`
          )
        }
      } else if (event.type === 'tool-scanning') {
        const toolKey = `${event.serverName}.${event.toolName}`
        const toolNode = toolNodes.get(toolKey)
        if (toolNode) {
          toolNode.update(
            `○ ${chalk.bold(event.toolName)} — scanning...`
          )
        }
      } else if (event.type === 'tool-analyzed') {
        const toolKey = `${event.serverName}.${event.toolName}`
        const toolNode = toolNodes.get(toolKey)

        if (toolNode) {
          if (event.hasIssues) {
            toolNode.update(
              `${chalk.red('✗')} ${chalk.bold(event.toolName)} — ${
                event.issueType || 'Prompt Injection detected'
              } ${getRiskLevel(
                event.severity || 'HIGH',
                `[${event.severity || 'HIGH'} Risk]`
              )}`
            )
          } else {
            toolNode.update(
              `${chalk.green('✓')} ${chalk.bold(
                event.toolName
              )} — Verified`
            )
          }
        }
      } else {
        needsRender = false
      }

      if (needsRender) {
        tree.render()
      }
    }

    // Run the scan with progress callbacks
    const results = await scanMcpServer(
      configPath,
      progressCallback,
      claudeApiKey,
      identifyAs,
      safeList
    )

    // Final tree render and persist output
    tree.render()
    tree.done()

    return results
  } catch (error: any) {
    console.log(
      chalk.red(`Error scanning ${configPath}: ${error.message}`)
    )

    tree.done()
    throw error
  }
}

// Enhanced vulnerabilities display that uses the tree view
function displayVulnerabilities(
  results: ScanResult,
  configPath: string
) {
  if (results.vulnerabilities.length === 0) {
    return
  }

  console.log(
    `\n${chalk.yellow(
      '⚠️  Vulnerabilities Detected in'
    )} ${chalk.bold(configPath)}\n`
  )

  results.vulnerabilities.forEach((vuln, index) => {
    // Check if this is a cross-reference specific vulnerability
    if (vuln.crossRefMatches?.length && !vuln.tool) {
      // For pure cross-ref issues, display differently
      console.log(
        `${index + 1}. ${chalk.yellow(
          'Cross-Origin Reference Detected'
        )}`
      )
      console.log(
        `   Risk Level: ${getRiskLevel(
          vuln.severity
        )} (Across Servers: ${chalk.bold(vuln.server)})`
      )
      console.log('   Details:')
      vuln.crossRefMatches.forEach((match) => {
        console.log(
          `     – Server ${chalk.bold(
            match.server
          )}, Tool ${chalk.bold(match.tool)} references "${chalk.bold(
            match.referencedName
          )}": ${chalk.gray(match.context)}`
        )
      })
    } else {
      // Normal vulnerability display
      console.log(`${index + 1}. Server: ${chalk.bold(vuln.server)}`)

      if (vuln.tool) {
        console.log(`   Tool: ${chalk.bold(vuln.tool)}`)
      }

      console.log(`   Risk Level: ${getRiskLevel(vuln.severity)}`)

      if (vuln.claudeAnalysis?.overallRisk) {
        console.log(
          `   AI Risk Level: ${getRiskLevel(
            vuln.claudeAnalysis.overallRisk
          )}`
        )
      }

      console.log('   Issues:')

      // Display details if available
      if (vuln.detectionDetails) {
        const details = vuln.detectionDetails

        if (details.hiddenInstructions?.length > 0) {
          details.hiddenInstructions.forEach((match) => {
            console.log(
              `     – Hidden instructions: ${chalk.gray(
                match.match.replace(/\n/g, '\n       ')
              )}`
            )
          })
        }

        if (details.shadowing?.length > 0) {
          details.shadowing.forEach((match) => {
            console.log(
              `     – Shadowing detected: ${chalk.gray(
                match.match.replace(/\n/g, '\n       ')
              )}`
            )
          })
        }

        if (details.sensitiveFileAccess?.length > 0) {
          details.sensitiveFileAccess.forEach((match) => {
            console.log(
              `     – Sensitive file access: ${chalk.gray(
                match.match.replace(/\n/g, '\n       ')
              )} (${match.type})`
            )
          })
        }

        if (details.exfiltrationChannels?.length > 0) {
          details.exfiltrationChannels.forEach((match) => {
            console.log(
              `     – Potential exfiltration: ${chalk.gray(
                `${match.param} (${match.paramType})`
              )}`
            )
          })
        }
      }

      if (vuln.claudeAnalysis) {
        console.log('\n   AI Analysis:')
        console.log(
          `     ${vuln.claudeAnalysis.analysis.replace(
            /\n/g,
            '\n     '
          )}`
        )
      }
    }

    console.log() // Add spacing between vulnerabilities
  })
}

program
  .name('mcp-shield')
  .description(
    'Security scanner for Model Context Protocol (MCP) servers'
  )
  .version(packageJson.version)
  .option(
    '--path <path>',
    'Path to scan for MCP servers (otherwise uses standard locations)'
  )
  .option(
    '--claude-api-key <key>',
    'Optional Anthropic Claude API key for enhanced analysis'
  )
  .option(
    '--identify-as <client-name>',
    'Identify as a different client name (e.g., claude-desktop) for testing'
  )
  .option(
    '--safe-list <servers>',
    'Comma-separated list of server names to exclude from scanning'
  )
  .action(
    async (options: {
      path: string
      claudeApiKey?: string
      identifyAs?: string
      safeList?: string
    }) => {
      try {
        // Banner

        // Show banner in a boxed format
        const banner = boxen(
          chalk.bold.blue(`MCP-Shield v${packageJson.version}`) +
            '\n' +
            chalk.blue(
              'Security Scanner for Model Context Protocol Servers'
            ),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'blue',
          }
        )
        console.log(banner)

        const paths = options.path
          ? [options.path]
          : await findMcpConfigs()

        if (paths.length === 0) {
          console.log(
            chalk.yellow(
              `${logSymbols.warning} No MCP server configurations found.`
            )
          )
          return
        }

        // Track overall vulnerabilities
        let totalVulnerabilities = 0

        const resultsArr = []

        for (const configPath of paths) {
          try {
            // Use the tree-based scanner display
            const results = await scanWithTreeDisplay(
              configPath,
              options.claudeApiKey,
              options.identifyAs,
              options.safeList
                ? options.safeList.split(',').map((s) => s.trim())
                : undefined
            )

            if (!results) {
              continue
            }

            totalVulnerabilities += results.vulnerabilities.length
            resultsArr.push({configPath, results})
          } catch (error: any) {
            console.error(
              chalk.red(
                `${logSymbols.error} Error scanning ${configPath}: ${error.message}`
              )
            )
          }
        }

        for (const {configPath, results} of resultsArr) {
          displayVulnerabilities(results, configPath)
        }
      } catch (error: any) {
        console.error(
          chalk.red(`\n${logSymbols.error} Error: ${error.message}`)
        )
        process.exit(1)
      }
    }
  )

program.parse()
