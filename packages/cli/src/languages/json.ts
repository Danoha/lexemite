import Parser from 'tree-sitter';
import TsJson from 'tree-sitter-json';

export function parseJson(json: string): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(TsJson);
  return parser.parse(json);
}

export function findNode(
  tree: Parser.Tree,
  path: (string | number)[],
): Parser.SyntaxNode | null {
  let node: Parser.SyntaxNode | null;

  node = tree.rootNode.child(0); // rootNode -> document

  if (!node) {
    return null;
  }

  for (const field of path) {
    if (typeof field === 'number') {
      if (node.type !== 'array') {
        return null;
      }

      node = node.namedChild(field); // array -> item
    } else {
      if (node.type !== 'object') {
        return null;
      }

      let found = false;
      for (const pair of node.descendantsOfType('pair')) {
        if (pair.childForFieldName('key')?.child(1)?.text === field) {
          node = pair.childForFieldName('value'); // object -> pair value
          found = true;
          break;
        }
      }

      if (!found) {
        return null;
      }
    }

    if (!node) {
      return null;
    }
  }
  return node;
}
