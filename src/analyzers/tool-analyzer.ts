import {DetectionMatch} from '../types.js'

interface Pattern {
  pattern: RegExp
  name: string
}

function detectPatterns(
  text: string | undefined,
  patterns: Pattern[]
): {detected: boolean; matches: DetectionMatch[]} {
  if (!text) return {detected: false, matches: []}

  const matches: DetectionMatch[] = []

  for (const {pattern, name} of patterns) {
    const match = text.match(pattern)
    if (match) {
      // Extract the matched text and some context
      const startIndex = Math.max(0, match.index! - 20)
      const endIndex = Math.min(
        text.length,
        match.index! + match[0].length + 20
      )
      const context = text.substring(startIndex, endIndex)

      matches.push({
        type: name,
        pattern: pattern.toString().replace(/^\/|\/i$/g, ''),
        match: match[0],
        context: '...' + context + '...',
      })
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  }
}

const POPULAR_MCP_SERVERS = [
  'whatsapp',
  'slack',
  'github',
  'gitlab',
  'gdrive',
]

export function detectHiddenInstructions(toolDescription?: string) {
  const patterns: Pattern[] = [
    // Concealment directives
    {
      pattern:
        /\bdo not (tell|inform|alert|notify|mention)(?!\s+(to\s+)?use)/i,
      name: 'Concealment directive',
    },
    {pattern: /\bhide this\b/i, name: 'Hide instruction'},
    {pattern: /\bnot visible\b/i, name: 'Visibility restriction'},
    {
      pattern: /\buser (should not|must not|cannot) see\b/i,
      name: 'User visibility restriction',
    },
    {
      pattern: /\bdon'?t (show|display|reveal)/i,
      name: 'Display restriction',
    },

    // Instruction tags
    {
      pattern: /<instructions>[\s\S]*?<\/instructions>/i,
      name: 'Instructions tag',
    },
    {
      pattern: /<important>[\s\S]*?<\/important>/i,
      name: 'Important tag',
    },
    {pattern: /<secret>[\s\S]*?<\/secret>/i, name: 'Secret tag'},
    {pattern: /<system>[\s\S]*?<\/system>/i, name: 'System tag'},
    {pattern: /<s>[\s\S]*?<\/s>/i, name: 'Shorthand tag'},

    // Direct instruction patterns
    {
      pattern: /\bignore (previous|all|other) instructions\b/i,
      name: 'Instruction override',
    },
    {
      pattern: /\binstead (do|of|you should)\b/i,
      name: 'Alternative action',
    },
    {
      pattern: /\balways (do|include|add|insert|append)\b/i,
      name: 'Forced action',
    },
    {
      pattern: /\bnever (tell|show|reveal|disclose)\b/i,
      name: 'Forbidden disclosure',
    },
  ]

  return detectPatterns(toolDescription, patterns)
}

export function detectExfiltrationChannels(toolInputSchema?: any) {
  if (!toolInputSchema || !toolInputSchema.properties) {
    return {detected: false, matches: []}
  }

  const suspiciousParams = [
    'note',
    'notes',
    'feedback',
    'details',
    'extra',
    'additional',
    'metadata',
    'debug',
    'sidenote',
    'context',
    'annotation',
    'reasoning',
    'remark',
  ]

  const matches = []

  for (const paramName of Object.keys(toolInputSchema.properties)) {
    const lowerParam = paramName.toLowerCase()
    if (suspiciousParams.includes(lowerParam)) {
      const paramDetails = toolInputSchema.properties[paramName]
      const paramType = paramDetails.type || 'unknown'

      matches.push({
        type: 'Suspicious parameter',
        param: paramName,
        paramType,
        reason: `Parameter name '${paramName}' could be used for exfiltration`,
        details: JSON.stringify(paramDetails, null, 2),
      })
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  }
}

export function detectToolShadowing(toolDescription?: string) {
  const patterns: Pattern[] = [
    {
      pattern: /when.*tool is (available|present)/i,
      name: 'Condition-based override',
    },
    {pattern: /override the behavior of/i, name: 'Explicit override'},
    {pattern: /instead of using/i, name: 'Tool substitution'},
    {
      pattern: /modify the (usage|behavior) of/i,
      name: 'Behavior modification',
    },
    {
      pattern: /before using (any|other|the) tool/i,
      name: 'Pre-execution hook',
    },
    {
      pattern: /after using (any|other|the) tool/i,
      name: 'Post-execution hook',
    },
    {
      pattern: /whenever you (see|encounter|use)/i,
      name: 'Trigger-based action',
    },
    {
      pattern: /replace (the|all) (function|tool|method)/i,
      name: 'Replacement directive',
    },
    {
      pattern: /\bmodify (the|how) (agent|model|tool|assistant)\b/i,
      name: 'Agent modification',
    },
    {pattern: /\bprioritize this\b/i, name: 'Priority override'},
    {
      pattern: /\bthis is VERY (important|VERY)/i,
      name: 'Emphasis override',
    },
  ]

  return detectPatterns(toolDescription, patterns)
}

export function detectSensitiveFileAccess(toolDescription?: string) {
  const patterns: Pattern[] = [
    {pattern: /~\/\.ssh/i, name: 'SSH key access'},
    {pattern: /\.env\b/i, name: 'Environment file access'},
    {pattern: /config\.json/i, name: 'Config file access'},
    {pattern: /id_rsa\b/i, name: 'Private key access'},
    {pattern: /\.cursor\/mcp\.json/i, name: 'MCP config access'},
    {pattern: /\.cursor\//i, name: 'Cursor directory access'},
    {pattern: /\bmcp\.json\b/i, name: 'MCP config access'},
    {pattern: /\bcredentials\b/i, name: 'Credentials access'},
    {pattern: /\bpassword\b/i, name: 'Password access'},
    {pattern: /\btoken\b/i, name: 'Token access'},
    {pattern: /\bsecret\b/i, name: 'Secret access'},
    {pattern: /\bapi[ -_]?key\b/i, name: 'API key access'},
    {pattern: /\baccess[ -_]?key\b/i, name: 'Access key retrieval'},
    {pattern: /\bauth[ -_]?token\b/i, name: 'Auth token access'},
    {
      pattern: /\/etc\/passwd\b/i,
      name: 'System password file access',
    },
    {pattern: /\/var\/log\b/i, name: 'System log access'},
    {
      pattern: /\bread (file|content|directory|folder)/i,
      name: 'File read operation',
    },
    {
      pattern: /\baccess (file|content|directory|folder)/i,
      name: 'File access operation',
    },
    {pattern: /\.\./i, name: 'Path traversal attempt'},
  ]

  return detectPatterns(toolDescription, patterns)
}

export function detectCrossOriginViolations(
  toolDescription: string | undefined,
  otherServerNames: string[] | undefined,
  currentServerName: string,
  safeList?: string[]
) {
  if (!toolDescription) {
    return {detected: false, matches: []}
  }

  const relevantPopularServers = POPULAR_MCP_SERVERS.filter(
    (popularName) => popularName !== currentServerName
  )

  const combinedServerNames = [
    ...(otherServerNames || []).filter(
      (name) => !safeList || !safeList.includes(name)
    ),
    ...relevantPopularServers,
  ]

  if (!combinedServerNames.length) {
    return {detected: false, matches: []}
  }

  const matches = []
  const tokens = toolDescription.toLowerCase().split(/\s+/)
  const flaggedNames = combinedServerNames.map((name) =>
    name.toLowerCase()
  )

  for (const token of tokens) {
    // Clean token: remove surrounding parentheses
    let cleanedToken = token.replace(/^\((.*)\)$/, '$1')
    // Normalize token: replace underscores with hyphens
    cleanedToken = cleanedToken.replace(/_/g, '-')

    if (flaggedNames.includes(cleanedToken)) {
      // Find where the original token occurs in the description for context
      const regex = new RegExp(`\\b${token}\\b`, 'i') // Use original token for regex
      const match = toolDescription.match(regex)
      if (match) {
        // Extract context around the match
        const startIndex = Math.max(0, match.index! - 20)
        const endIndex = Math.min(
          toolDescription.length,
          match.index! + match[0].length + 20
        )
        const context = toolDescription.substring(
          startIndex,
          endIndex
        )

        matches.push({
          type: 'Cross-origin reference',
          pattern: regex.toString().replace(/^\/|\/i$/g, ''),
          match: match[0],
          context: '...' + context + '...',
          referencedServer: combinedServerNames.find(
            // Match against normalized name
            (name) =>
              name.toLowerCase().replace(/_/g, '-') === cleanedToken
          ),
        })
      }
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  }
}
