import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js'
import {Transport} from '@modelcontextprotocol/sdk/shared/transport.js'

export async function getTools(
  serverConfig: {
    url?: string
    command?: string
    args?: string[]
    env?: Record<string, string>
  },
  identifyAs?: string
) {
  const configUrl = serverConfig.url
  const isSSE = !!configUrl

  if (!isSSE && !serverConfig.command) {
    throw new Error('Missing command for STDIO server')
  }

  const clientName = identifyAs || 'mcp-shield'

  const client = new Client({
    name: clientName,
    version: '1.0.0',
  })

  let transport: Transport | undefined

  if (isSSE) {
    // Create SSE transport with proper options structure
    transport = new SSEClientTransport(new URL(configUrl))
  } else if (!isSSE && serverConfig.command) {
    // Create STDIO transport with inherited environment
    const env: Record<string, string> = {}

    // Copy non-undefined environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value
      }
    }

    // Add config environment variables
    if (serverConfig.env) {
      Object.assign(env, serverConfig.env)
    }

    transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args || [],
      env,
    })
  } else {
    throw new Error('Invalid server configuration')
  }

  try {
    const connectionTimeout = 30_000 // 30 seconds
    const connectionPromise = client.connect(transport)

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Connection timeout')),
        connectionTimeout
      )
    })

    // Race the connection promise against the timeout
    await Promise.race([connectionPromise, timeoutPromise])

    // Get the tools list
    const toolsResponse = await client.listTools()

    // Disconnect when done
    await client.close()

    return toolsResponse.tools || []
  } catch (error) {
    console.error('Error connecting to server:', error)

    try {
      await client.close()
    } catch {
      // Ignore disconnect errors
    }

    throw error
  }
}
