import Parser from 'tree-sitter';
import TSJson from 'tree-sitter-json';
import { describe, expect, it } from 'vitest';

import { findNode } from '../../src/languages/json.ts';

const parser = new Parser();
parser.setLanguage(TSJson);
const tree = parser.parse(`{"foo": [1, 2, {"bar": "baz"}]}`);

describe('findNode', () => {
  it('should find root node', () => {
    expect(findNode(tree, [])?.text).toBe(`{"foo": [1, 2, {"bar": "baz"}]}`);
  });

  it('should find object entry foo', () => {
    expect(findNode(tree, ['foo'])?.text).toBe(`[1, 2, {"bar": "baz"}]`);
  });

  it('should find array entry 0', () => {
    expect(findNode(tree, ['foo', 0])?.text).toBe('1');
  });

  it('should find object entry bar', () => {
    expect(findNode(tree, ['foo', 2, 'bar'])?.text).toBe(`"baz"`);
  });
});
