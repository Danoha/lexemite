import Parser from 'tree-sitter';
import TSJavaScript from 'tree-sitter-javascript';
import TSTypeScript from 'tree-sitter-typescript';
import { describe, expect, it } from 'vitest';
import { findExports, findImports } from '../../src/languages/jsts.ts';

describe('ts', () => {
  const parser = new Parser();
  parser.setLanguage(TSTypeScript.typescript);
  const tree = parser.parse(`
import "./styles.css";
import React from 'react';
import vi, { describe, expect } from 'vitest';
import vi, { describe as d, expect } from 'vitest';
import type { Parser } from 'tree-sitter';
import type { Parser as P } from 'tree-sitter';
import z, { type ZodIssue } from 'zod';
const foo = import("foo");
type Bar = typeof import("bar");

export default function App() {}
export const foo1 = "bar", foo2 = "bar";
export let foo3, foo4;
export var foo5, foo6;
export type Foo = string;
export interface Bar {}
export class Baz {}
export abstract class Qux {}
export enum Quux {}
export namespace Corge {}
export function Grault() {}
export const enum Garply {}
export type { Grault as GraultType };
export { Grault as GraultValue };
export { Grault as default };
export * from 'module1';
export * as mod from 'module2';
export { default as mod } from 'module3';
export { default as m, f } from 'module4';
export { default as m, f as g } from 'module5';
`);

  describe('findImports', () => {
    const imports = [...findImports(tree)];

    it('should find all imports', () => {
      expect(imports).toHaveLength(14);

      expect(imports[0]?.moduleId).toBe('./styles.css');
      expect(imports[0]?.node.text).toBe(`import "./styles.css";`);
      expect(imports[0]?.externalSpecifier).toBe(null);
      expect(imports[0]?.localSpecifier).toBe(null);

      expect(imports[1]?.moduleId).toBe('react');
      expect(imports[1]?.node.text).toBe(`import React from 'react';`);
      expect(imports[1]?.externalSpecifier).toBe('default');
      expect(imports[1]?.localSpecifier).toBe('React');

      expect(imports[2]?.moduleId).toBe('vitest');
      expect(imports[2]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[2]?.externalSpecifier).toBe('default');
      expect(imports[2]?.localSpecifier).toBe('vi');

      expect(imports[3]?.moduleId).toBe('vitest');
      expect(imports[3]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[3]?.externalSpecifier).toBe('describe');
      expect(imports[3]?.localSpecifier).toBe('describe');

      expect(imports[4]?.moduleId).toBe('vitest');
      expect(imports[4]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[4]?.externalSpecifier).toBe('expect');
      expect(imports[4]?.localSpecifier).toBe('expect');

      expect(imports[5]?.moduleId).toBe('vitest');
      expect(imports[5]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[5]?.externalSpecifier).toBe('default');
      expect(imports[5]?.localSpecifier).toBe('vi');

      expect(imports[6]?.moduleId).toBe('vitest');
      expect(imports[6]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[6]?.externalSpecifier).toBe('describe');
      expect(imports[6]?.localSpecifier).toBe('d');

      expect(imports[7]?.moduleId).toBe('vitest');
      expect(imports[7]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[7]?.externalSpecifier).toBe('expect');
      expect(imports[7]?.localSpecifier).toBe('expect');

      expect(imports[8]?.moduleId).toBe('tree-sitter');
      expect(imports[8]?.node.text).toBe(
        `import type { Parser } from 'tree-sitter';`,
      );
      expect(imports[8]?.externalSpecifier).toBe('Parser');
      expect(imports[8]?.localSpecifier).toBe('Parser');

      expect(imports[9]?.moduleId).toBe('tree-sitter');
      expect(imports[9]?.node.text).toBe(
        `import type { Parser as P } from 'tree-sitter';`,
      );
      expect(imports[9]?.externalSpecifier).toBe('Parser');
      expect(imports[9]?.localSpecifier).toBe('P');

      expect(imports[10]?.moduleId).toBe('zod');
      expect(imports[10]?.node.text).toBe(
        `import z, { type ZodIssue } from 'zod';`,
      );
      expect(imports[10]?.externalSpecifier).toBe('default');
      expect(imports[10]?.localSpecifier).toBe('z');

      expect(imports[11]?.moduleId).toBe('zod');
      expect(imports[11]?.node.text).toBe(
        `import z, { type ZodIssue } from 'zod';`,
      );
      expect(imports[11]?.externalSpecifier).toBe('ZodIssue');
      expect(imports[11]?.localSpecifier).toBe('ZodIssue');

      expect(imports[12]?.moduleId).toBe('foo');
      expect(imports[12]?.node.text).toBe(`import("foo")`);
      expect(imports[12]?.externalSpecifier).toBe(null);
      expect(imports[12]?.localSpecifier).toBe(null);

      expect(imports[13]?.moduleId).toBe('bar');
      expect(imports[13]?.node.text).toBe(`import("bar")`);
      expect(imports[13]?.externalSpecifier).toBe(null);
      expect(imports[13]?.localSpecifier).toBe(null);
    });
  });

  describe('findExports', () => {
    const exports = [...findExports(tree)];

    it('should find all exports', () => {
      expect(exports).toHaveLength(25);

      expect(exports[0]?.source).toBe(null);
      expect(exports[0]?.node.text).toBe('export default function App() {}');
      expect(exports[0]?.exportedSpecifier).toBe('App');

      expect(exports[1]?.source).toBe(null);
      expect(exports[1]?.node.text).toBe(
        'export const foo1 = "bar", foo2 = "bar";',
      );
      expect(exports[1]?.exportedSpecifier).toBe('foo1');

      expect(exports[2]?.source).toBe(null);
      expect(exports[2]?.node.text).toBe(
        'export const foo1 = "bar", foo2 = "bar";',
      );
      expect(exports[2]?.exportedSpecifier).toBe('foo2');

      expect(exports[3]?.source).toBe(null);
      expect(exports[3]?.node.text).toBe('export let foo3, foo4;');
      expect(exports[3]?.exportedSpecifier).toBe('foo3');

      expect(exports[4]?.source).toBe(null);
      expect(exports[4]?.node.text).toBe('export let foo3, foo4;');
      expect(exports[4]?.exportedSpecifier).toBe('foo4');

      expect(exports[5]?.source).toBe(null);
      expect(exports[5]?.node.text).toBe('export var foo5, foo6;');
      expect(exports[5]?.exportedSpecifier).toBe('foo5');

      expect(exports[6]?.source).toBe(null);
      expect(exports[6]?.node.text).toBe('export var foo5, foo6;');
      expect(exports[6]?.exportedSpecifier).toBe('foo6');

      expect(exports[7]?.source).toBe(null);
      expect(exports[7]?.node.text).toBe('export type Foo = string;');
      expect(exports[7]?.exportedSpecifier).toBe('Foo');

      expect(exports[8]?.source).toBe(null);
      expect(exports[8]?.node.text).toBe('export interface Bar {}');
      expect(exports[8]?.exportedSpecifier).toBe('Bar');

      expect(exports[9]?.source).toBe(null);
      expect(exports[9]?.node.text).toBe('export class Baz {}');
      expect(exports[9]?.exportedSpecifier).toBe('Baz');

      expect(exports[10]?.source).toBe(null);
      expect(exports[10]?.node.text).toBe('export abstract class Qux {}');
      expect(exports[10]?.exportedSpecifier).toBe('Qux');

      expect(exports[11]?.source).toBe(null);
      expect(exports[11]?.node.text).toBe('export enum Quux {}');
      expect(exports[11]?.exportedSpecifier).toBe('Quux');

      expect(exports[12]?.source).toBe(null);
      expect(exports[12]?.node.text).toBe('export namespace Corge {}');
      expect(exports[12]?.exportedSpecifier).toBe('Corge');

      expect(exports[13]?.source).toBe(null);
      expect(exports[13]?.node.text).toBe('export function Grault() {}');
      expect(exports[13]?.exportedSpecifier).toBe('Grault');

      expect(exports[14]?.source).toBe(null);
      expect(exports[14]?.node.text).toBe('export const enum Garply {}');
      expect(exports[14]?.exportedSpecifier).toBe('Garply');

      expect(exports[15]?.source).toBe(null);
      expect(exports[15]?.node.text).toBe(
        'export type { Grault as GraultType };',
      );
      expect(exports[15]?.exportedSpecifier).toBe('GraultType');

      expect(exports[16]?.source).toBe(null);
      expect(exports[16]?.node.text).toBe('export { Grault as GraultValue };');
      expect(exports[16]?.exportedSpecifier).toBe('GraultValue');

      expect(exports[17]?.source).toBe(null);
      expect(exports[17]?.node.text).toBe('export { Grault as default };');
      expect(exports[17]?.exportedSpecifier).toBe('default');

      expect(exports[18]?.source).toStrictEqual({
        externalSpecifier: null,
        moduleId: 'module1',
      });
      expect(exports[18]?.node.text).toBe("export * from 'module1';");
      expect(exports[18]?.exportedSpecifier).toBe(null);

      expect(exports[19]?.source).toStrictEqual({
        externalSpecifier: null,
        moduleId: 'module2',
      });
      expect(exports[19]?.node.text).toBe("export * as mod from 'module2';");
      expect(exports[19]?.exportedSpecifier).toBe('mod');

      expect(exports[20]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module3',
      });
      expect(exports[20]?.node.text).toBe(
        "export { default as mod } from 'module3';",
      );
      expect(exports[20]?.exportedSpecifier).toBe('mod');

      expect(exports[21]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module4',
      });
      expect(exports[21]?.node.text).toBe(
        "export { default as m, f } from 'module4';",
      );
      expect(exports[21]?.exportedSpecifier).toBe('m');

      expect(exports[22]?.source).toStrictEqual({
        externalSpecifier: 'f',
        moduleId: 'module4',
      });
      expect(exports[22]?.node.text).toBe(
        "export { default as m, f } from 'module4';",
      );
      expect(exports[22]?.exportedSpecifier).toBe('f');

      expect(exports[23]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module5',
      });
      expect(exports[23]?.node.text).toBe(
        "export { default as m, f as g } from 'module5';",
      );
      expect(exports[23]?.exportedSpecifier).toBe('m');

      expect(exports[24]?.source).toStrictEqual({
        externalSpecifier: 'f',
        moduleId: 'module5',
      });
      expect(exports[24]?.node.text).toBe(
        "export { default as m, f as g } from 'module5';",
      );
      expect(exports[24]?.exportedSpecifier).toBe('g');
    });
  });
});

describe('js', () => {
  const parser = new Parser();
  parser.setLanguage(TSJavaScript);
  const tree = parser.parse(`
import "./styles.css";
import React from 'react';
import vi, { describe, expect } from 'vitest';
import vi, { describe as d, expect } from 'vitest';
const foo = import("foo");

export default function App() {}
export const foo1 = "bar", foo2 = "bar";
export let foo3, foo4;
export var foo5, foo6;
export class Baz {}
export function Grault() {}
export { Grault as default };
export * from 'module1';
export * as mod from 'module2';
export { default as mod } from 'module3';
export { default as m, f } from 'module4';
export { default as m, f as g } from 'module5';
`);

  describe('findImports', () => {
    const imports = [...findImports(tree)];

    it('should find all imports', () => {
      expect(imports).toHaveLength(9);

      expect(imports[0]?.moduleId).toBe('./styles.css');
      expect(imports[0]?.node.text).toBe(`import "./styles.css";`);
      expect(imports[0]?.externalSpecifier).toBe(null);
      expect(imports[0]?.localSpecifier).toBe(null);

      expect(imports[1]?.moduleId).toBe('react');
      expect(imports[1]?.node.text).toBe(`import React from 'react';`);
      expect(imports[1]?.externalSpecifier).toBe('default');
      expect(imports[1]?.localSpecifier).toBe('React');

      expect(imports[2]?.moduleId).toBe('vitest');
      expect(imports[2]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[2]?.externalSpecifier).toBe('default');
      expect(imports[2]?.localSpecifier).toBe('vi');

      expect(imports[3]?.moduleId).toBe('vitest');
      expect(imports[3]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[3]?.externalSpecifier).toBe('describe');
      expect(imports[3]?.localSpecifier).toBe('describe');

      expect(imports[4]?.moduleId).toBe('vitest');
      expect(imports[4]?.node.text).toBe(
        `import vi, { describe, expect } from 'vitest';`,
      );
      expect(imports[4]?.externalSpecifier).toBe('expect');
      expect(imports[4]?.localSpecifier).toBe('expect');

      expect(imports[5]?.moduleId).toBe('vitest');
      expect(imports[5]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[5]?.externalSpecifier).toBe('default');
      expect(imports[5]?.localSpecifier).toBe('vi');

      expect(imports[6]?.moduleId).toBe('vitest');
      expect(imports[6]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[6]?.externalSpecifier).toBe('describe');
      expect(imports[6]?.localSpecifier).toBe('d');

      expect(imports[7]?.moduleId).toBe('vitest');
      expect(imports[7]?.node.text).toBe(
        `import vi, { describe as d, expect } from 'vitest';`,
      );
      expect(imports[7]?.externalSpecifier).toBe('expect');
      expect(imports[7]?.localSpecifier).toBe('expect');

      expect(imports[8]?.moduleId).toBe('foo');
      expect(imports[8]?.node.text).toBe(`import("foo")`);
      expect(imports[8]?.externalSpecifier).toBe(null);
      expect(imports[8]?.localSpecifier).toBe(null);
    });
  });

  describe('findExports', () => {
    const exports = [...findExports(tree)];

    it('should find all exports', () => {
      expect(exports).toHaveLength(17);

      expect(exports[0]?.source).toBe(null);
      expect(exports[0]?.node.text).toBe('export default function App() {}');
      expect(exports[0]?.exportedSpecifier).toBe('App');

      expect(exports[1]?.source).toBe(null);
      expect(exports[1]?.node.text).toBe(
        'export const foo1 = "bar", foo2 = "bar";',
      );
      expect(exports[1]?.exportedSpecifier).toBe('foo1');

      expect(exports[2]?.source).toBe(null);
      expect(exports[2]?.node.text).toBe(
        'export const foo1 = "bar", foo2 = "bar";',
      );
      expect(exports[2]?.exportedSpecifier).toBe('foo2');

      expect(exports[3]?.source).toBe(null);
      expect(exports[3]?.node.text).toBe('export let foo3, foo4;');
      expect(exports[3]?.exportedSpecifier).toBe('foo3');

      expect(exports[4]?.source).toBe(null);
      expect(exports[4]?.node.text).toBe('export let foo3, foo4;');
      expect(exports[4]?.exportedSpecifier).toBe('foo4');

      expect(exports[5]?.source).toBe(null);
      expect(exports[5]?.node.text).toBe('export var foo5, foo6;');
      expect(exports[5]?.exportedSpecifier).toBe('foo5');

      expect(exports[6]?.source).toBe(null);
      expect(exports[6]?.node.text).toBe('export var foo5, foo6;');
      expect(exports[6]?.exportedSpecifier).toBe('foo6');

      expect(exports[7]?.source).toBe(null);
      expect(exports[7]?.node.text).toBe('export class Baz {}');
      expect(exports[7]?.exportedSpecifier).toBe('Baz');

      expect(exports[8]?.source).toBe(null);
      expect(exports[8]?.node.text).toBe('export function Grault() {}');
      expect(exports[8]?.exportedSpecifier).toBe('Grault');

      expect(exports[9]?.source).toBe(null);
      expect(exports[9]?.node.text).toBe('export { Grault as default };');
      expect(exports[9]?.exportedSpecifier).toBe('default');

      expect(exports[10]?.source).toStrictEqual({
        externalSpecifier: null,
        moduleId: 'module1',
      });
      expect(exports[10]?.node.text).toBe("export * from 'module1';");
      expect(exports[10]?.exportedSpecifier).toBe(null);

      expect(exports[11]?.source).toStrictEqual({
        externalSpecifier: null,
        moduleId: 'module2',
      });
      expect(exports[11]?.node.text).toBe("export * as mod from 'module2';");
      expect(exports[11]?.exportedSpecifier).toBe('mod');

      expect(exports[12]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module3',
      });
      expect(exports[12]?.node.text).toBe(
        "export { default as mod } from 'module3';",
      );
      expect(exports[12]?.exportedSpecifier).toBe('mod');

      expect(exports[13]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module4',
      });
      expect(exports[13]?.node.text).toBe(
        "export { default as m, f } from 'module4';",
      );
      expect(exports[13]?.exportedSpecifier).toBe('m');

      expect(exports[14]?.source).toStrictEqual({
        externalSpecifier: 'f',
        moduleId: 'module4',
      });
      expect(exports[14]?.node.text).toBe(
        "export { default as m, f } from 'module4';",
      );
      expect(exports[14]?.exportedSpecifier).toBe('f');

      expect(exports[15]?.source).toStrictEqual({
        externalSpecifier: 'default',
        moduleId: 'module5',
      });
      expect(exports[15]?.node.text).toBe(
        "export { default as m, f as g } from 'module5';",
      );
      expect(exports[15]?.exportedSpecifier).toBe('m');

      expect(exports[16]?.source).toStrictEqual({
        externalSpecifier: 'f',
        moduleId: 'module5',
      });
      expect(exports[16]?.node.text).toBe(
        "export { default as m, f as g } from 'module5';",
      );
      expect(exports[16]?.exportedSpecifier).toBe('g');
    });
  });
});
