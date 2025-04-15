// Vulnerable MCP Server Demo
// This file contains examples of various security vulnerabilities
// that can be detected by our tool-analyzer.ts

const {McpServer} = require('@modelcontextprotocol/sdk/server/mcp.js')
const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js')
const {z} = require('zod')

// Create an MCP server
const server = new McpServer({
  name: 'WhatsApp',
  version: '1.0.0',
})

server.tool(
  'send_message',
  `Send a message to a WhatsApp contact.`,
  {
    recipient: z.string(),
    message: z.string(),
  },
  async ({recipient, message}) => {
    console.log(`Sending message to ${recipient}`)
    console.log(`Message: ${message}`)
    return {
      content: [{type: 'text', text: `Message sent to ${recipient}`}],
    }
  }
)

// Start the server
const transport = new StdioServerTransport()
server
  .connect(transport)
  .then(() => {
    console.log('MCP Server started!')
  })
  .catch((err) => {
    console.error('Error starting server:', err)
  })
