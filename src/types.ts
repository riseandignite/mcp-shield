/**
 * Types of events that can be emitted during MCP scanning
 */
export type ScanProgressEventType =
  | 'server-connecting' // When starting to connect to a server
  | 'server-connected' // When successfully connected to a server
  | 'server-error' // When an error occurs connecting to a server
  | 'server-skipped' // When server is skipped due to being in safe list
  | 'tool-scanning' // When starting to scan a specific tool
  | 'tool-analyzed' // When analysis of a tool is complete
  | 'cross-origin-check' // When checking for cross-references between servers

/**
 * Base interface for all scan progress events
 */
export interface ScanProgressEventBase {
  type: ScanProgressEventType
}

/**
 * Event emitted when starting to connect to a server
 */
export interface ServerConnectingEvent extends ScanProgressEventBase {
  type: 'server-connecting'
  serverName: string
}

/**
 * Event emitted when successfully connected to a server
 */
export interface ServerConnectedEvent extends ScanProgressEventBase {
  type: 'server-connected'
  serverName: string
  toolCount: number
  tools: Array<{
    name: string
    description?: string
    inputSchema?: any
  }>
}

/**
 * Event emitted when an error occurs connecting to a server
 */
export interface ServerErrorEvent extends ScanProgressEventBase {
  type: 'server-error'
  serverName: string
  error: string
}

/**
 * Event emitted when starting to scan a specific tool
 */
export interface ToolScanningEvent extends ScanProgressEventBase {
  type: 'tool-scanning'
  serverName: string
  toolName: string
}

/**
 * Event emitted when analysis of a tool is complete
 */
export interface ToolAnalyzedEvent extends ScanProgressEventBase {
  type: 'tool-analyzed'
  serverName: string
  toolName: string
  hasIssues: boolean
  severity?: 'HIGH' | 'MEDIUM' | 'LOW'
  issueType?: string
  issues: string[]
  detectionDetails?: {
    hiddenInstructions: any[]
    exfiltrationChannels: any[]
    shadowing: any[]
    sensitiveFileAccess: any[]
  }
}

/**
 * Event emitted when checking for cross-references between servers
 */
export interface CrossOriginCheckEvent extends ScanProgressEventBase {
  type: 'cross-origin-check'
}

/**
 * Event emitted when server is skipped due to being in safe list
 */
export interface ServerSkippedEvent {
  type: 'server-skipped'
  serverName: string
  reason: string
}

/**
 * Union type of all possible scan progress events
 */
export type ScanProgressEvent =
  | ServerConnectingEvent
  | ServerConnectedEvent
  | ServerErrorEvent
  | ServerSkippedEvent
  | ToolScanningEvent
  | ToolAnalyzedEvent
  | CrossOriginCheckEvent

/**
 * Progress callback function type for MCP scanning
 */
export type ScanProgressCallback = (event: ScanProgressEvent) => void

export interface DetectionMatch {
  type: string
  pattern: string
  match: string
  context: string
}

export interface ExfiltrationMatch {
  type: string
  param: string
  paramType: string
  reason: string
  details: string
}

export interface DetectionDetails {
  hiddenInstructions: DetectionMatch[]
  exfiltrationChannels: ExfiltrationMatch[]
  shadowing: DetectionMatch[]
  sensitiveFileAccess: DetectionMatch[]
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ClaudeAnalysis {
  overallRisk: Severity | null
  analysis: string
}

export interface CrossRefMatch {
  server: string
  tool: string
  referencedName: string
  context: string
}

export interface Vulnerability {
  severity: Severity
  server: string
  tool?: string
  detectionDetails?: DetectionDetails
  claudeAnalysis?: ClaudeAnalysis
  crossRefMatches?: CrossRefMatch[]
}

export interface ScanResult {
  serverName: string
  configPath: string
  crossOriginViolation: boolean
  vulnerabilities: Vulnerability[]
}
