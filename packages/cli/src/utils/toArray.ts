export function toArray<T>(input: T | T[] | undefined): T[] {
  if (input === undefined) {
    return [];
  }

  return Array.isArray(input) ? input : [input];
}
