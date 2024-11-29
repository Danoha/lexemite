import { describe, expect, it } from "vitest";

import { compile } from "../src/compile.js";
import {
	exportDeclaration,
	identifier,
	importCall,
	importDeclaration,
	importsAndExports,
	stringLiteral,
} from "../src/languages/js.js";

function parser(source: string) {
	return {
		source,
		position: 0,
	};
}

describe("stringLiteral", () => {
	const matcher = compile(stringLiteral);

	it("should return undefined on mismatch", () => {
		expect(matcher(parser("abc"))).toBeUndefined();
		expect(matcher(parser("def"))).toBeUndefined();
	});

	it("should return the matched string literal", () => {
		expect(matcher(parser("'module-name'"))).toStrictEqual({
			kind: "literal",
			text: "module-name",
			start: 0,
			end: 13,
		});
	});

	it("should match string literal with special characters", () => {
		expect(matcher(parser("'emoji: 🦄'"))).toStrictEqual({
			kind: "literal",
			text: "emoji: 🦄",
			start: 0,
			end: 11,
		});
	});

	it("should match string literal with escaped apostrophe", () => {
		expect(matcher(parser(String.raw`'escaped: \''`))).toStrictEqual({
			kind: "literal",
			text: String.raw`escaped: \'`,
			start: 0,
			end: 13,
		});
	});

	it("should match string literal with escaped quotes", () => {
		expect(matcher(parser(String.raw`'escaped: \"'`))).toStrictEqual({
			kind: "literal",
			text: String.raw`escaped: \"`,
			start: 0,
			end: 13,
		});
	});
});

describe("identifier", () => {
	it("should return undefined on mismatch", () => {
		const matcher = compile(identifier);

		expect(matcher(parser("123"))).toBeUndefined();
		expect(matcher(parser("123abc"))).toBeUndefined();
	});

	it("should return the matched identifier", () => {
		const matcher = compile(identifier);

		expect(matcher(parser("abc"))).toStrictEqual({
			kind: "identifier",
			text: "abc",
			start: 0,
			end: 3,
		});
		expect(matcher(parser("abc1_23"))).toStrictEqual({
			kind: "identifier",
			text: "abc1_23",
			start: 0,
			end: 7,
		});
	});
});

describe("importDeclaration", () => {
	const matcher = compile(importDeclaration);

	it("should return undefined on mismatch", () => {
		expect(matcher(parser("abc"))).toBeUndefined();
		expect(matcher(parser("def"))).toBeUndefined();
	});

	it("should return the matched import declaration", () => {
		expect(matcher(parser("import 'module-name';"))).toStrictEqual({
			kind: "import",
			defaultImport: null,
			specifier: null,
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 7,
				end: 20,
			},
		});
	});

	it("should match import with default import", () => {
		expect(matcher(parser("import name from 'module-name';"))).toStrictEqual({
			kind: "import",
			defaultImport: {
				kind: "default",
				alias: {
					kind: "identifier",
					text: "name",
					start: 7,
					end: 11,
				},
				isTypeOnly: false,
			},
			specifier: null,
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 17,
				end: 30,
			},
		});
	});

	it("should match import with namespace import", () => {
		expect(matcher(parser("import * as ns from 'module-name';"))).toStrictEqual(
			{
				kind: "import",
				defaultImport: null,
				specifier: {
					kind: "namespace",
					alias: {
						kind: "identifier",
						text: "ns",
						start: 12,
						end: 14,
					},
					isTypeOnly: false,
					start: 7,
					end: 15,
				},
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 20,
					end: 33,
				},
			},
		);
	});

	it("should match import with default and namespace import", () => {
		expect(
			matcher(parser("import name, * as ns from 'module-name';")),
		).toStrictEqual({
			kind: "import",
			defaultImport: {
				kind: "default",
				alias: {
					kind: "identifier",
					text: "name",
					start: 7,
					end: 11,
				},
				isTypeOnly: false,
			},
			specifier: {
				kind: "namespace",
				alias: {
					kind: "identifier",
					text: "ns",
					start: 18,
					end: 20,
				},
				isTypeOnly: false,
				start: 13,
				end: 21,
			},
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 26,
				end: 39,
			},
		});
	});

	it("should match import with named imports", () => {
		expect(
			matcher(parser("import { name1, name2 as alias2 } from 'module-name';")),
		).toStrictEqual({
			kind: "import",
			defaultImport: null,
			specifier: {
				kind: "named",
				namedImports: [
					{
						external: {
							isTypeOnly: false,
							name: {
								kind: "identifier",
								text: "name1",
								start: 9,
								end: 14,
							},
						},
						local: {
							kind: "identifier",
							text: "name1",
							start: 9,
							end: 14,
						},
					},
					{
						external: {
							isTypeOnly: false,
							name: {
								kind: "identifier",
								text: "name2",
								start: 16,
								end: 21,
							},
						},
						local: {
							kind: "identifier",
							text: "alias2",
							start: 25,
							end: 31,
						},
					},
				],
			},
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 39,
				end: 52,
			},
		});
	});

	it("should match import with named imports with string literal", () => {
		expect(
			matcher(
				parser(
					"import { 'name1' as alias1, name2 as alias2 } from 'module-name';",
				),
			),
		).toStrictEqual({
			kind: "import",
			defaultImport: null,
			specifier: {
				kind: "named",
				namedImports: [
					{
						external: {
							isTypeOnly: false,
							name: {
								kind: "literal",
								text: "name1",
								start: 9,
								end: 17,
							},
						},
						local: {
							kind: "identifier",
							text: "alias1",
							start: 20,
							end: 26,
						},
					},
					{
						external: {
							isTypeOnly: false,
							name: {
								kind: "identifier",
								text: "name2",
								start: 28,
								end: 33,
							},
						},
						local: {
							kind: "identifier",
							text: "alias2",
							start: 37,
							end: 43,
						},
					},
				],
			},
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 51,
				end: 64,
			},
		});
	});
});

describe("import call", () => {
	const matcher = compile(importCall);

	it("should match simple import call", () => {
		expect(matcher(parser("import('module-name')"))).toStrictEqual({
			kind: "import-call",
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 7,
				end: 20,
			},
		});
	});

	it("should match import call with options", () => {
		expect(
			matcher(parser("import('module-name', { option: 'value' })")),
		).toStrictEqual({
			kind: "import-call",
			moduleSpecifier: {
				kind: "literal",
				text: "module-name",
				start: 7,
				end: 20,
			},
		});
	});
});

describe("exportDeclaration", () => {
	const matcher = compile(exportDeclaration);

	it("should return undefined on mismatch", () => {
		expect(matcher(parser("export abc"))).toBeUndefined();
	});

	describe("export default", () => {
		it("should match default export of identifier", () => {
			expect(matcher(parser("export default abc"))).toStrictEqual({
				kind: "export",
				moduleSpecifier: null,
				specifier: {
					isTypeOnly: false,
					kind: "default",
				},
			});
		});

		it("should match default export of object literal", () => {
			expect(matcher(parser("export default {}"))).toStrictEqual({
				kind: "export",
				moduleSpecifier: null,
				specifier: {
					isTypeOnly: false,
					kind: "default",
				},
			});
		});
	});

	describe("export item", () => {
		it.each([
			"class abc",
			"function abc",
			"function *abc",
			"async function abc",
			"async function *abc",
			"const abc",
			"let abc",
			"var abc",
			"type abc =",
			"interface abc {",
			"enum abc {",
		])("should match %s", (source) => {
			const identifierStartsAt = source.indexOf("abc") + 7;

			expect(matcher(parser(`export ${source}`))).toStrictEqual({
				kind: "export",
				moduleSpecifier: null,
				specifier: {
					kind: "item",
					isTypeOnly: /type|interface/.test(source),
					name: {
						kind: "identifier",
						text: "abc",
						start: identifierStartsAt,
						end: identifierStartsAt + 3,
					},
				},
			});
		});
	});

	describe("export with module specifier", () => {
		it("should match default export with module specifier", () => {
			expect(
				matcher(parser("export default from 'module-name';")),
			).toStrictEqual({
				kind: "export",
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 20,
					end: 33,
				},
				specifier: {
					kind: "default",
					isTypeOnly: false,
				},
			});
		});

		it("should match star export with module specifier", () => {
			expect(matcher(parser("export * from 'module-name';"))).toStrictEqual({
				kind: "export",
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 14,
					end: 27,
				},
				specifier: {
					kind: "namespace",
					alias: null,
					isTypeOnly: false,
				},
			});
		});

		it("should match aliased namespace export with module specifier", () => {
			expect(
				matcher(parser("export * as ns from 'module-name';")),
			).toStrictEqual({
				kind: "export",
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 20,
					end: 33,
				},
				specifier: {
					kind: "namespace",
					alias: {
						kind: "identifier",
						text: "ns",
						start: 12,
						end: 14,
					},
					isTypeOnly: false,
				},
			});
		});

		it("should match named exports with module specifier", () => {
			expect(
				matcher(
					parser(
						"export { name1, name2 as alias2, default } from 'module-name';",
					),
				),
			).toStrictEqual({
				kind: "export",
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 48,
					end: 61,
				},
				specifier: {
					kind: "named",
					namedExports: [
						{
							external: {
								isTypeOnly: false,
								name: {
									kind: "identifier",
									text: "name1",
									start: 9,
									end: 14,
								},
							},
							local: {
								kind: "identifier",
								text: "name1",
								start: 9,
								end: 14,
							},
						},
						{
							external: {
								isTypeOnly: false,
								name: {
									kind: "identifier",
									text: "name2",
									start: 16,
									end: 21,
								},
							},
							local: {
								kind: "identifier",
								text: "alias2",
								start: 25,
								end: 31,
							},
						},
						{
							external: {
								isTypeOnly: false,
								name: {
									kind: "identifier",
									text: "default",
									start: 33,
									end: 40,
								},
							},
							local: {
								kind: "identifier",
								text: "default",
								start: 33,
								end: 40,
							},
						},
					],
				},
			});
		});
	});
});

describe("importsAndExports", () => {
	const matcher = compile(importsAndExports);

	it("should return empty array on no match", () => {
		expect(matcher(parser("abc"))).toStrictEqual([]);
	});

	it("should match simple module", () => {
		expect(
			matcher(
				parser(`
            import 'module-name';
            
            export default {};
        `),
			),
		).toStrictEqual([
			{
				kind: "import",
				defaultImport: null,
				specifier: null,
				moduleSpecifier: {
					kind: "literal",
					text: "module-name",
					start: 20,
					end: 33,
				},
			},
			{
				kind: "export",
				moduleSpecifier: null,
				specifier: {
					kind: "default",
					isTypeOnly: false,
				},
			},
		]);
	});

	it("should match more complex module", () => {
		expect(
			matcher(
				parser(`
            import 'module-name';
            
            export default {};
            
            export class LOL {
                async doAThing() {
                    return await import
                    (
                        'module-name'
                    ).then(whocares);
                }
            }
            
            export { name1, type name2 as alias2 } from 'module-name';
            
            export * from 'module-name';

			export type * as fest from "type-fest";
                `),
			),
		).toMatchInlineSnapshot(`
			[
			  {
			    "defaultImport": null,
			    "kind": "import",
			    "moduleSpecifier": {
			      "end": 33,
			      "kind": "literal",
			      "start": 20,
			      "text": "module-name",
			    },
			    "specifier": null,
			  },
			  {
			    "kind": "export",
			    "moduleSpecifier": null,
			    "specifier": {
			      "isTypeOnly": false,
			      "kind": "default",
			    },
			  },
			  {
			    "kind": "export",
			    "moduleSpecifier": null,
			    "specifier": {
			      "isTypeOnly": false,
			      "kind": "item",
			      "name": {
			        "end": 120,
			        "kind": "identifier",
			        "start": 117,
			        "text": "LOL",
			      },
			    },
			  },
			  {
			    "kind": "import-call",
			    "moduleSpecifier": {
			      "end": 278,
			      "kind": "literal",
			      "start": 244,
			      "text": "module-name",
			    },
			  },
			  {
			    "kind": "export",
			    "moduleSpecifier": {
			      "end": 410,
			      "kind": "literal",
			      "start": 397,
			      "text": "module-name",
			    },
			    "specifier": {
			      "kind": "named",
			      "namedExports": [
			        {
			          "external": {
			            "isTypeOnly": false,
			            "name": {
			              "end": 367,
			              "kind": "identifier",
			              "start": 362,
			              "text": "name1",
			            },
			          },
			          "local": {
			            "end": 367,
			            "kind": "identifier",
			            "start": 362,
			            "text": "name1",
			          },
			        },
			        {
			          "external": {
			            "isTypeOnly": true,
			            "name": {
			              "end": 379,
			              "kind": "identifier",
			              "start": 374,
			              "text": "name2",
			            },
			          },
			          "local": {
			            "end": 389,
			            "kind": "identifier",
			            "start": 383,
			            "text": "alias2",
			          },
			        },
			      ],
			    },
			  },
			  {
			    "kind": "export",
			    "moduleSpecifier": {
			      "end": 464,
			      "kind": "literal",
			      "start": 451,
			      "text": "module-name",
			    },
			    "specifier": {
			      "alias": null,
			      "isTypeOnly": false,
			      "kind": "namespace",
			    },
			  },
			  {
			    "kind": "export",
			    "moduleSpecifier": {
			      "end": 508,
			      "kind": "literal",
			      "start": 497,
			      "text": "type-fest",
			    },
			    "specifier": {
			      "alias": {
			        "end": 491,
			        "kind": "identifier",
			        "start": 487,
			        "text": "fest",
			      },
			      "isTypeOnly": true,
			      "kind": "namespace",
			    },
			  },
			]
		`);
	});
});
