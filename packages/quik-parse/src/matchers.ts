export interface OperatorSeq<
	// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
	TOperands extends readonly Matcher[] = readonly any[],
> {
	readonly kind: "seq";
	readonly operands: TOperands;
	readonly allowWhitespace: boolean;
	strict(): OperatorSeq<TOperands>;
}

// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
export interface OperatorChoice<TMatcher extends Matcher = any> {
	readonly kind: "choice";
	readonly operands: readonly TMatcher[];
}

// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
export interface OperatorRepeat<TMatcher extends Matcher = any> {
	readonly kind: "repeat";
	readonly operand: TMatcher;
}

export interface OperatorOptional<
	// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
	TMatcher extends Matcher = any,
	// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
	TDefaultValue = any,
> {
	readonly kind: "optional";
	readonly operand: TMatcher;
	readonly defaultValue: TDefaultValue;
}

export interface OperatorAs<
	// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
	TMatcher extends Matcher = any,
	TOutput = unknown,
> {
	kind: "as";
	operand: TMatcher;
	transform: (input: Matches<TMatcher>, start: number, end: number) => TOutput;
}

// biome-ignore lint/suspicious/noExplicitAny: default must be any for correct inference
export interface OperatorSkipUntil<TMatcher extends Matcher = any> {
	kind: "skipUntil";
	matcher: TMatcher;
}

export type Operator =
	| OperatorSeq
	| OperatorChoice
	| OperatorRepeat
	| OperatorOptional
	| OperatorAs
	| OperatorSkipUntil;

export type Matcher = string | RegExp | Operator;

export type Matches<TMatcher extends Matcher> = TMatcher extends string
	? TMatcher
	: TMatcher extends RegExp
		? string
		: TMatcher extends OperatorSeq<infer TOperands>
			? { [TKey in keyof TOperands]: Matches<TOperands[TKey]> }
			: TMatcher extends OperatorChoice<infer TOperand>
				? Matches<TOperand>
				: TMatcher extends OperatorRepeat<infer TOperand>
					? Matches<TOperand>[]
					: TMatcher extends OperatorOptional<
								infer TOperand,
								infer TDefaultValue
							>
						? Matches<TOperand> | TDefaultValue
						: // biome-ignore lint/suspicious/noExplicitAny: <explanation>
							TMatcher extends OperatorAs<any, infer TOutput>
							? TOutput
							: TMatcher extends OperatorSkipUntil<infer TOperand>
								? Matches<TOperand>
								: never;

export const whitespace = /\s+/;

export function seq<const TOperands extends readonly Matcher[]>(
	...operands: TOperands
): OperatorSeq<TOperands> {
	return {
		kind: "seq",
		operands,
		allowWhitespace: true,
		strict() {
			return {
				...this,
				allowWhitespace: false,
				strict() {
					return this;
				},
			};
		},
	};
}

export function choice<const TOperands extends readonly Matcher[]>(
	...operands: TOperands
): OperatorChoice<TOperands[number]> {
	return {
		kind: "choice",
		operands,
	};
}

export function repeat<const TOperand extends Matcher>(
	operand: TOperand,
): OperatorRepeat<TOperand> {
	return {
		kind: "repeat",
		operand,
	};
}

export function optional<
	const TOperand extends Matcher,
	const TDefaultValue = null,
>(
	operand: TOperand,
	defaultValue: TDefaultValue = null as TDefaultValue,
): OperatorOptional<TOperand, TDefaultValue> {
	return {
		kind: "optional",
		operand,
		defaultValue,
	};
}

export function as<const TOperand extends Matcher, const TOutput>(
	operand: TOperand,
	transform: (input: Matches<TOperand>, start: number, end: number) => TOutput,
): OperatorAs<TOperand, TOutput> {
	return {
		kind: "as",
		operand,
		transform,
	};
}

export function skipUntil<const TOperand extends Matcher>(
	matcher: TOperand,
): OperatorSkipUntil<TOperand> {
	return {
		kind: "skipUntil",
		matcher,
	};
}
