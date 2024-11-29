import { describe, expect, it } from "vitest";
import {
	compileAs,
	compileChoice,
	compileOptional,
	compileRegex,
	compileRepeat,
	compileSeq,
	compileSkipUntil,
	compileString,
} from "../src/compile.js";
import {
	as,
	choice,
	optional,
	repeat,
	seq,
	skipUntil,
} from "../src/matchers.js";

function parser(source: string, position: number) {
	return {
		source,
		position,
	};
}

describe("string", () => {
	it("should return undefined on mismatch", () => {
		const matcher = compileString("def");

		expect(matcher(parser("abc", 0))).toBeUndefined();
		expect(matcher(parser("def", 1))).toBeUndefined();
	});

	it("should return the matched string", () => {
		const matcher = compileString("def");

		expect(matcher(parser("def", 0))).toBe("def");
		expect(matcher(parser("ddef", 1))).toBe("def");
		expect(matcher(parser("ddefd", 1))).toBe("def");
	});

	it("should return the matched string with special characters", () => {
		const matcher = compileString("emoji: 🦄");

		expect(matcher(parser("emoji: 🦄", 0))).toBe("emoji: 🦄");
		expect(matcher(parser("aemoji: 🦄", 1))).toBe("emoji: 🦄");
	});

	it("should increase the position", () => {
		const matcher = compileString("def");
		const p = parser("def", 0);

		matcher(p);

		expect(p.position).toBe(3);
	});

	it("should increase the position with special characters", () => {
		const matcher = compileString("emoji: 🦄");
		const p = parser("emoji: 🦄", 0);

		matcher(p);

		expect(p.source.slice(p.position)).toBe("");
	});

	it("should return undefined on partial match", () => {
		const matcher = compileString("def");
		const p = parser("de", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should not increase the position on partial match", () => {
		const matcher = compileString("def");
		const p = parser("de", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});
});

describe("regex", () => {
	it("should return undefined on mismatch", () => {
		const matcher = compileRegex(/def/);

		expect(matcher(parser("abc", 0))).toBeUndefined();
		expect(matcher(parser("ddef", 0))).toBeUndefined();
	});

	it("should return the matched string", () => {
		const matcher = compileRegex(/[def]{3}/);

		expect(matcher(parser("def", 0))).toBe("def");
		expect(matcher(parser("ddef", 0))).toBe("dde");
		expect(matcher(parser("ddefd", 2))).toBe("efd");
	});

	it("should return the matched string with special characters", () => {
		const matcher = compileRegex(/emoji: [🦄🍎]/u);

		expect(matcher(parser("emoji: 🦄KEK", 0))).toBe("emoji: 🦄");
		expect(matcher(parser("aemoji: 🍎LOL", 1))).toBe("emoji: 🍎");
	});

	it("should increase the position", () => {
		const matcher = compileRegex(/def/);
		const p = parser("def", 0);

		matcher(p);

		expect(p.position).toBe(3);
	});

	it("should increase the position with special characters", () => {
		const matcher = compileRegex(/emoji: [🦄🍎]/u);
		const p = parser("emoji: 🦄KEK", 0);

		matcher(p);

		expect(p.source.slice(p.position)).toBe("KEK");
	});

	it("should return undefined on partial match", () => {
		const matcher = compileRegex(/def/);
		const p = parser("de", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should not increase the position on partial match", () => {
		const matcher = compileRegex(/def/);
		const p = parser("de", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});
});

describe("seq", () => {
	describe("without whitespace", () => {
		const matcher = compileSeq(seq("a", "b", "c").strict());

		it("should return undefined on mismatch", () => {
			const p = parser("cabc", 0);

			expect(matcher(p)).toBeUndefined();
		});

		it("should return the matched strings", () => {
			const p = parser("abc", 0);

			expect(matcher(p)).toStrictEqual(["a", "b", "c"]);
		});

		it("should increase the position", () => {
			const p = parser("abc", 0);

			matcher(p);

			expect(p.position).toBe(3);
		});

		it("should return undefined on partial match", () => {
			const p = parser("ab", 0);

			expect(matcher(p)).toBeUndefined();
		});

		it("should not increase the position on partial match", () => {
			const p = parser("ab", 0);

			matcher(p);

			expect(p.position).toBe(0);
		});

		it("should not match when whitespace is present", () => {
			const p1 = parser(" abc", 0);
			const p2 = parser("a bc", 0);
			const p3 = parser("a bc", 0);
			const p4 = parser("ab c", 0);

			expect(matcher(p1)).toBeUndefined();
			expect(matcher(p2)).toBeUndefined();
			expect(matcher(p3)).toBeUndefined();
			expect(matcher(p4)).toBeUndefined();
		});

		it("should match when whitespace is at the end", () => {
			const p = parser("abc ", 0);

			expect(matcher(p)).toStrictEqual(["a", "b", "c"]);

			expect(p.position).toBe(3);
		});
	});

	describe("with whitespace", () => {
		const matcher = compileSeq(seq("a", "b", "c"));

		it("should return undefined on mismatch", () => {
			const p = parser("cabc", 0);

			expect(matcher(p)).toBeUndefined();
		});

		it("should return the matched strings", () => {
			const p = parser("\na  bc", 0);

			expect(matcher(p)).toStrictEqual(["a", "b", "c"]);
		});

		it("should increase the position", () => {
			const p = parser("a  b  c", 0);

			matcher(p);

			expect(p.position).toBe(7);
		});

		it("should return undefined on partial match", () => {
			const p = parser("ab", 0);

			expect(matcher(p)).toBeUndefined();
		});

		it("should not increase the position on partial match", () => {
			const p = parser("ab", 0);

			matcher(p);

			expect(p.position).toBe(0);
		});
	});
});

describe("choice", () => {
	const matcher = compileChoice(choice("ab", "b", "c"));

	it("should return undefined on mismatch", () => {
		const p = parser("d", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should return the matched string", () => {
		const p = parser("b", 0);

		expect(matcher(p)).toBe("b");
	});

	it("should increase the position", () => {
		const p = parser("c", 0);

		matcher(p);

		expect(p.position).toBe(1);
	});

	it("should return undefined on partial match", () => {
		const p = parser("a", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should not increase the position on partial match", () => {
		const p = parser("a", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});
});

describe("as", () => {
	const matcher = compileAs(
		as("import", (keyword, start, end) => ({ keyword, start, end })),
	);

	it("should return undefined on mismatch", () => {
		const p = parser("export", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should return the matched object", () => {
		const p = parser("LOLimport", 3);

		expect(matcher(p)).toStrictEqual({ keyword: "import", start: 3, end: 9 });
	});

	it("should increase the position", () => {
		const p = parser("import", 0);

		matcher(p);

		expect(p.position).toBe(6);
	});

	it("should return undefined on partial match", () => {
		const p = parser("imp", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should not increase the position on partial match", () => {
		const p = parser("imp", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});
});

describe("repeat", () => {
	const matcher = compileRepeat(repeat("abc"));

	it("should return empty array on mismatch", () => {
		const p = parser("dabc", 0);

		expect(matcher(p)).toStrictEqual([]);
	});

	it("should return the matched strings", () => {
		const p = parser("abcabcabc", 0);

		expect(matcher(p)).toStrictEqual(["abc", "abc", "abc"]);
	});

	it("should increase the position", () => {
		const p = parser("abcabcabc", 0);

		matcher(p);

		expect(p.position).toBe(9);
	});

	it("should return empty array on partial match", () => {
		const p = parser("ab", 0);

		expect(matcher(p)).toStrictEqual([]);
	});

	it("should not increase the position on partial match", () => {
		const p = parser("ab", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});

	it("should not ignore whitespace", () => {
		const p = parser("abc abc", 0);

		expect(matcher(p)).toStrictEqual(["abc"]);

		expect(p.position).toBe(3);
	});
});

describe("optional", () => {
	const matcher = compileOptional(optional("abc", "default"));

	it("should return the default value on mismatch", () => {
		const p = parser("dabc", 0);

		expect(matcher(p)).toBe("default");
	});

	it("should return the matched string", () => {
		const p = parser("abc", 0);

		expect(matcher(p)).toBe("abc");
	});

	it("should increase the position", () => {
		const p = parser("abc", 0);

		matcher(p);

		expect(p.position).toBe(3);
	});

	it("should not increase the position on mismatch", () => {
		const p = parser("dabc", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});

	it("should not increase the position on partial match", () => {
		const p = parser("ab", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});

	it("should not ignore whitespace", () => {
		const p = parser(" abc", 0);

		expect(matcher(p)).toBe("default");

		expect(p.position).toBe(0);
	});
});

describe("skipUntil", () => {
	const matcher = compileSkipUntil(skipUntil("abc"));

	it("should return undefined on mismatch", () => {
		const p = parser("cba", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should return undefined on partial match", () => {
		const p = parser("ab", 0);

		expect(matcher(p)).toBeUndefined();
	});

	it("should return the matched string", () => {
		const p = parser("abc", 0);

		expect(matcher(p)).toBe("abc");
	});

	it("should increase the position", () => {
		const p = parser("  abc", 0);

		matcher(p);

		expect(p.position).toBe(5);
	});

	it("should not increase the position on partial match", () => {
		const p = parser("   ab", 0);

		matcher(p);

		expect(p.position).toBe(0);
	});
});
