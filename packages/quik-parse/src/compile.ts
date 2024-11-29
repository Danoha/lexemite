import {
	type Matcher,
	type Matches,
	type OperatorAs,
	type OperatorChoice,
	type OperatorOptional,
	type OperatorRepeat,
	type OperatorSeq,
	type OperatorSkipUntil,
	whitespace,
} from "./matchers.ts";

export interface Parser {
	readonly source: string;
	position: number;
}

export function compileString<TMatcher extends string>(matcher: TMatcher) {
	return new Function(
		"parser",
		`
        const matcher = ${JSON.stringify(matcher)};
        let position = parser.position;
        
        for (const char of matcher) {
            if (position >= parser.source.length || String.fromCodePoint(parser.source.codePointAt(position)) !== char) {
                return undefined;
            }
            
            position += char.length;
        }
        
        parser.position = position;
        return matcher;
    `,
	) as (parser: Parser) => Matches<TMatcher> | undefined;
}

export function compileRegex(matcher: RegExp) {
	return new Function(
		"parser",
		`
        const match = parser.source.slice(parser.position).match(/^${matcher.source}/${matcher.flags});
        
        if (match === null) {
            return undefined;
        }
        
        parser.position += match[0].length;
        return match[0];
    `,
	) as (parser: Parser) => Matches<RegExp> | undefined;
}

export function compileSeq<TOperands extends readonly Matcher[]>(
	matcher: OperatorSeq<TOperands>,
) {
	const operands = matcher.operands.map((operand) => compile(operand));
	const { allowWhitespace } = matcher;

	return (
		new Function(
			"operands",
			"whitespace",
			`
            return (parser) => {
                const childParser = { ...parser };
                const matches = [];
                
                ${operands
									.map(
										(_, index) => `
                whitespace(childParser);
                const match${index} = operands[${index}](childParser);
                if (match${index} === undefined) {
                    return undefined;
                }
                matches.push(match${index});
                `,
									)
									.join("\n")}
                whitespace(childParser);
                parser.position = childParser.position;
                return matches;
            }   
            `,
		) as (
			operands: unknown[],
			whitespace: (parser: Parser) => string | undefined,
		) => (parser: Parser) => Matches<OperatorSeq<TOperands>> | undefined
	)(operands, allowWhitespace ? compileRegex(whitespace) : () => undefined);
}

export function compileChoice<TOperand extends Matcher>(
	matcher: OperatorChoice<TOperand>,
) {
	const operands = matcher.operands.map((operand) => compile(operand));

	return (
		new Function(
			"operands",
			`
            return (parser) => {
                const childParser = { ...parser };
                
                ${operands
									.map(
										(_, index) => `
                const match${index} = operands[${index}](childParser);
                if (match${index} !== undefined) {
                    parser.position = childParser.position;
                    return match${index};
                }
                `,
									)
									.join("\n")}
                
                return undefined;
            }   
            `,
		) as (
			operands: unknown[],
		) => (parser: Parser) => Matches<OperatorChoice<TOperand>> | undefined
	)(operands);
}

export function compileAs<TOperand extends Matcher, TOutput>(
	matcher: OperatorAs<TOperand, TOutput>,
) {
	const operand = compile(matcher.operand);
	const { transform } = matcher;

	return (
		new Function(
			"operand",
			"transform",
			`
            return (parser) => {
                const start = parser.position;
                const match = operand(parser);
                if (match === undefined) {
                    return undefined;
                }
                
                return transform(match, start, parser.position);
            }
            `,
		) as (
			operand: unknown,
			transform: unknown,
		) => (parser: Parser) => TOutput | undefined
	)(operand, transform);
}

export function compileRepeat<TOperand extends Matcher>(
	matcher: OperatorRepeat<TOperand>,
) {
	const operand = compile(matcher.operand);

	return (
		new Function(
			"operand",
			`
            return (parser) => {
                const matches = [];
                
                while (true) {
                    const match = operand(parser);
                    if (match === undefined) {
                        break;
                    }
                    matches.push(match);
                }
                
                return matches;
            }
            `,
		) as (
			operand: unknown,
		) => (parser: Parser) => Matches<OperatorRepeat<TOperand>>
	)(operand);
}

export function compileOptional<TOperand extends Matcher, TDefaultValue>(
	matcher: OperatorOptional<TOperand, TDefaultValue>,
) {
	const operand = compile(matcher.operand);

	return (
		new Function(
			"operand",
			"defaultValue",
			`
            return (parser) => {
                const match = operand(parser);
                if (match === undefined) {
                    return defaultValue;
                }

                return match;
            }
            `,
		) as (
			operand: unknown,
			defaultValue: unknown,
		) => (parser: Parser) => Matches<OperatorOptional<TOperand, TDefaultValue>>
	)(operand, matcher.defaultValue);
}

export function compileSkipUntil<TOperand extends Matcher>(
	matcher: OperatorSkipUntil<TOperand>,
) {
	const operand = compile(matcher.matcher);

	return (
		new Function(
			"operand",
			`
            return (parser) => {
                const childParser = { ...parser };
                while (childParser.position < childParser.source.length) {
                    const match = operand(childParser);
                    if (match !== undefined) {
                        parser.position = childParser.position;
                        return match;
                    }
                    childParser.position++;
                }
                return undefined;
            }
            `,
		) as (
			operand: unknown,
		) => (parser: Parser) => Matches<OperatorSkipUntil<TOperand>>
	)(operand);
}

export function compile<TMatcher extends Matcher>(
	matcher: TMatcher,
): (parser: Parser) => Matches<TMatcher> | undefined {
	if (typeof matcher === "string") {
		return compileString(matcher);
	}
	if (matcher instanceof RegExp) {
		return compileRegex(matcher) as (
			parser: Parser,
		) => Matches<TMatcher> | undefined;
	}

	switch (matcher.kind) {
		case "seq":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileSeq(matcher) as any;
		case "choice":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileChoice(matcher) as any;
		case "as":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileAs(matcher) as any;
		case "repeat":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileRepeat(matcher) as any;
		case "optional":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileOptional(matcher) as any;
		case "skipUntil":
			// biome-ignore lint/suspicious/noExplicitAny: /shrug
			return compileSkipUntil(matcher) as any;
	}
}
