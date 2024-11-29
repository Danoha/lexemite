import {
	type Matches,
	as,
	choice,
	optional,
	repeat,
	seq,
	skipUntil,
} from "../matchers.ts";

export const stringLiteral = as(
	choice(seq('"', /(?:\\"|[^"])+/u, '"'), seq("'", /(?:\\'|[^'])+/u, "'")),
	([, text], start, end) => ({
		kind: "literal",
		text,
		start,
		end,
	}),
);

export type StringLiteral = Matches<typeof stringLiteral>;

export const identifier = as(/[a-zA-Z_]\w*/, (text, start, end) => ({
	kind: "identifier",
	text,
	start,
	end,
}));

export type Identifier = Matches<typeof identifier>;

export const defaultImportSpecifier = as(
	seq(optional("type"), identifier),
	([type, alias]) => ({
		kind: "default",
		isTypeOnly: !!type,
		alias,
	}),
);

export const importSpecifier = as(
	seq(optional("type"), choice(identifier, stringLiteral)),
	([type, name]) => ({
		isTypeOnly: !!type,
		name,
	}),
);

export const namedImportSpecifier = as(
	seq(optional(","), importSpecifier, optional(seq("as", identifier))),
	([, external, local]) => ({
		external,
		local: local?.[1] ?? external.name,
	}),
);

/**
 * All possible import declarations:
 *
 * import "module-name";
 * import * as ns from "module-name";
 * import type * as ns from "module-name";
 * import { name } from "module-name";
 * import type { name } from "module-name";
 * import { name as alias } from "module-name";
 * import { type name as alias } from "module-name";
 * import { "name" as alias } from "module-name";
 * import { name1, name2 } from "module-name";
 * import { name1 as alias1, name2 as alias2 } from "module-name";
 * import name from "module-name";
 * import type name from "module-name";
 * import name, * as ns from "module-name";
 * import type name, * as ns from "module-name";
 * import name, type * as ns from "module-name";
 * import name, { name1, name2 } from "module-name";
 * import name, { name1 as alias1, name2 as alias2 } from "module-name";
 * import name, { "name1" as alias1, name2 as alias2 } from "module-name";
 */
export const importDeclaration = as(
	seq(
		"import",
		optional(defaultImportSpecifier),
		optional(","),
		optional(
			choice(
				as(
					seq(optional("type"), "*", "as", choice(identifier, stringLiteral)),
					([type, , , alias], start, end) => ({
						kind: "namespace",
						isTypeOnly: !!type,
						alias,
						start,
						end,
					}),
				),
				as(
					seq(optional("type"), "{", repeat(namedImportSpecifier), "}"),
					([type, , namedImports]) => ({
						kind: "named",
						namedImports: namedImports.map(({ external, local }) => ({
							external: {
								...external,
								isTypeOnly: external.isTypeOnly || !!type,
							},
							local,
						})),
					}),
				),
			),
		),
		optional("from"),
		stringLiteral,
	),
	([, defaultImport, , specifier, , moduleSpecifier]) => ({
		kind: "import",
		defaultImport,
		specifier,
		moduleSpecifier,
	}),
);

export type ImportDeclaration = Matches<typeof importDeclaration>;

export const importCall = as(
	seq("import", "(", stringLiteral),
	([, , moduleSpecifier]) => ({
		kind: "import-call",
		moduleSpecifier,
	}),
);

export type ImportCall = Matches<typeof importCall>;

/**
 * All possible export declarations:
 *
 * export * from "module-name";
 * export type * from "module-name";
 * export { name } from "module-name";
 * export { name as alias } from "module-name";
 * export { name1, name2 } from "module-name";
 * export { name1 as alias1, name2 as alias2 } from "module-name";
 * export { default } from "module-name";
 * export type { default } from "module-name";
 * export { type default } from "module-name";
 * export { default as alias } from "module-name";
 * export { type default as alias } from "module-name";
 * export * as ns from "module-name";
 * export type * as ns from "module-name";
 * export { name };
 * export { name as alias };
 * export type { name };
 * export type { name as alias };
 * export class name { ... };
 * export abstract class name { ... };
 * export function name() { ... };
 * export function* name() { ... };
 * export async function name() { ... };
 * export async function* name() { ... };
 * export interface name { ... };
 * export type name = value;
 * export enum name { ... };
 * export namespace name { ... };
 * export const name = value;
 * export let name = value;
 * export var name = value;
 * export default expression;
 */
export const exportDeclaration = as(
	seq(
		"export",
		choice(
            as(
                seq("type", identifier, "="),
                ([, name]) => ({ kind: "item", name, isTypeOnly: true }),
            ),
			as(
				seq(optional("type"), "*", optional(seq("as", identifier))),
				([type, , alias]) => ({
					kind: "namespace",
					isTypeOnly: !!type,
					alias: alias?.[1] ?? null,
				}),
			),
			as(
				seq(optional("type"), "{", repeat(namedImportSpecifier), "}"),
				([type, , namedExports]) => ({
					kind: "named",
					namedExports: namedExports.map(({ external, local }) => ({
						external: {
							...external,
							isTypeOnly: external.isTypeOnly || !!type,
						},
						local,
					})),
				}),
			),
			as(
				seq(optional("async"), "function", optional("*"), identifier),
				([, , , name]) => ({ kind: "item", name, isTypeOnly: false }),
			),
			as(
				seq(
					choice("class",seq("abstract", "class"),  "const", "let", "var", "enum"),
					identifier,
				),
				([, name]) => ({ kind: "item", name, isTypeOnly: false }),
			),
			as(
				seq(
					choice("type", "interface"),
					identifier,
				),
				([, name]) => ({ kind: "item", name, isTypeOnly: true }),
			),
			as(seq(optional("type"), "default"), ([type]) => ({ kind: "default", isTypeOnly: !!type })),
		),
		optional(seq("from", stringLiteral)),
	),
	([, specifier, moduleSpecifier]) => ({
		kind: "export",
		specifier,
		moduleSpecifier: moduleSpecifier?.[1] ?? null,
	}),
);

export type ExportDeclaration = Matches<typeof exportDeclaration>;

export const importsAndExports = repeat(
	skipUntil(choice(importDeclaration, importCall, exportDeclaration)),
);

export type ImportsAndExports = Matches<typeof importsAndExports>;