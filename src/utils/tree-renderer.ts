import logUpdate from 'log-update'

export class TreeNode {
  id: string
  content: string
  parent: TreeNode | null
  children: TreeNode[] = []

  constructor(
    id: string,
    content: string,
    parent: TreeNode | null = null
  ) {
    this.id = id
    this.content = content
    this.parent = parent
  }

  /**
   * Updates the content of this node
   * Only updates if the content is different
   */
  update(content: string): void {
    // Don't update if the content is the same - prevents duplicate rendering
    if (this.content !== content) {
      this.content = content
    }
  }

  /**
   * Adds a child node to this node
   */
  addChild(id: string, content: string): TreeNode {
    const child = new TreeNode(id, content, this)
    this.children.push(child)
    return child
  }
}

/**
 * A simple tree rendering utility that supports live updates
 */
export class Tree {
  private root: TreeNode | null = null
  private nodes: Map<string, TreeNode> = new Map()
  private nodeIdCounter: number = 0
  private lastOutput: string = ''
  private committed: boolean = false

  // Rendering options
  private prefix: string = '  '
  private joint: string = '├── '
  private vertical: string = '│   '
  private last: string = '└── '

  constructor(options?: {
    prefix?: string
    joint?: string
    vertical?: string
    last?: string
  }) {
    if (options) {
      this.prefix = options.prefix ?? this.prefix
      this.joint = options.joint ?? this.joint
      this.vertical = options.vertical ?? this.vertical
      this.last = options.last ?? this.last
    }
  }

  /**
   * Adds the root node to the tree
   */
  addRoot(content: string): TreeNode {
    const id = `node-${this.nodeIdCounter++}`
    const node = new TreeNode(id, content, null)
    this.root = node
    this.nodes.set(id, node)
    return node
  }

  /**
   * Adds a child node to the specified parent
   */
  addChild(parent: TreeNode, content: string): TreeNode {
    const id = `node-${this.nodeIdCounter++}`
    const child = parent.addChild(id, content)
    this.nodes.set(id, child)
    return child
  }

  /**
   * Renders the tree to the console
   * Updates the display in-place using log-update
   */
  render(): void {
    // Don't render if already committed
    if (this.committed) return

    const lines: string[] = []
    if (this.root) {
      this.renderNode(this.root, '', true, lines)
    }
    const output = lines.join('\n')

    // Only update if the output has changed
    if (output !== this.lastOutput) {
      logUpdate(output)
      this.lastOutput = output
    }
  }

  clear() {
    if (!this.committed) {
      logUpdate.clear()
      this.lastOutput = ''
    }
  }

  done() {
    if (!this.committed) {
      logUpdate.done()
      this.committed = true // Mark as committed
    }
  }

  /**
   * Renders a single node and all its children
   */
  private renderNode(
    node: TreeNode,
    prefix: string = '',
    isLast: boolean = true,
    lines: string[] = []
  ) {
    const isRoot = node === this.root
    const line = isRoot
      ? node.content
      : prefix + (isLast ? this.last : this.joint) + node.content
    lines.push(line)

    const childPrefix =
      prefix + (isLast ? this.prefix : this.vertical)
    const children = node.children
    children.forEach((child, index) => {
      this.renderNode(
        child,
        childPrefix,
        index === children.length - 1,
        lines
      )
    })
  }
}
