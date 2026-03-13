// ---------------------------------------------------------------------------
// Tree-sitter AST utility functions
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SyntaxNode = any;

/** Check if a node is inside a comment. */
export function isInsideComment(node: SyntaxNode): boolean {
  let current: SyntaxNode | null = node;
  while (current) {
    const type = current.type;
    if (
      type === 'comment' ||
      type === 'line_comment' ||
      type === 'block_comment' ||
      type === 'documentation_comment' ||
      type === 'doc_comment'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** Check if a node is inside a string literal. */
export function isInsideString(node: SyntaxNode): boolean {
  let current: SyntaxNode | null = node;
  while (current) {
    const type = current.type;
    if (
      type === 'string' ||
      type === 'string_literal' ||
      type === 'template_string' ||
      type === 'template_literal' ||
      type === 'raw_string_literal' ||
      type === 'interpreted_string_literal' ||
      type === 'string_content'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** Check if a node is inside a string or comment (false positive filter). */
export function isInNonCodeContext(node: SyntaxNode): boolean {
  return isInsideComment(node) || isInsideString(node);
}

/** Get the function body node that contains the given node (if any). */
export function getEnclosingFunction(node: SyntaxNode): SyntaxNode | null {
  let current: SyntaxNode | null = node.parent;
  while (current) {
    const type = current.type;
    if (
      type === 'function_declaration' ||
      type === 'function_definition' ||
      type === 'arrow_function' ||
      type === 'method_definition' ||
      type === 'method_declaration' ||
      type === 'function_item' // Rust
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/** Get the function body as a string. */
export function getFunctionBody(funcNode: SyntaxNode): string | null {
  const body = funcNode.childForFieldName('body');
  return body ? body.text : null;
}

/** Get all descendant nodes matching a predicate. */
export function findDescendants(
  root: SyntaxNode,
  predicate: (node: SyntaxNode) => boolean,
): SyntaxNode[] {
  const results: SyntaxNode[] = [];
  const cursor = root.walk();

  let reachedRoot = false;
  while (!reachedRoot) {
    if (predicate(cursor.currentNode)) {
      results.push(cursor.currentNode);
    }

    if (cursor.gotoFirstChild()) continue;
    if (cursor.gotoNextSibling()) continue;

    while (true) {
      if (!cursor.gotoParent()) {
        reachedRoot = true;
        break;
      }
      if (cursor.gotoNextSibling()) break;
    }
  }

  return results;
}

/** Get the text of a line range (1-based) from source code. */
export function getLineRange(code: string, startLine: number, endLine: number): string {
  const lines = code.split('\n');
  return lines.slice(startLine - 1, endLine).join('\n');
}
