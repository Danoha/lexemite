import type { UnionToTuple } from 'type-fest';
import z, { type ZodIssue } from 'zod';
import { Engine } from './engine.ts';
import { plugins } from './plugins/index.ts';

const pluginNameSchema = z.enum(
  Object.keys(plugins) as UnionToTuple<keyof typeof plugins>,
  {
    message: `Expected one of: ${Object.keys(plugins).sort().join(', ')}`,
  },
);

export const configSchema = z
  .object({
    plugins: z
      .array(
        z.union([
          z.object(
            {
              apply: z.function(z.tuple([z.instanceof(Engine)]), z.void(), {
                message: 'Expected plugin object with an apply method',
              }),
            },
            { message: 'Expected plugin object with an apply method' },
          ),
          z
            .union([
              pluginNameSchema,
              z.tuple([pluginNameSchema, z.unknown()], {
                errorMap: () => ({
                  message: 'Expected tuple with a plugin name and options',
                }),
              }),
            ])
            .superRefine(async (input, ctx) => {
              const name = typeof input === 'string' ? input : input[0];
              const options = typeof input === 'string' ? undefined : input[1];
              const Plugin = await plugins[name]();
              const parseResult = await Plugin.schema.safeParseAsync(options);

              if (parseResult.success) {
                return;
              }

              for (const issue of parseResult.error.issues) {
                ctx.addIssue(issue);
              }

              return z.NEVER;
            })
            .transform(async (input) => {
              const name = typeof input === 'string' ? input : input[0];
              const rawOptions =
                typeof input === 'string' ? undefined : input[1];
              const Plugin = await plugins[name]();
              const options = await Plugin.schema.parseAsync(rawOptions);
              // biome-ignore lint/suspicious/noExplicitAny: Because we're dynamically importing plugins, we can't type them.
              return new Plugin(options as any);
            }),
        ]),
      )
      .default([]),
  })
  .strict();

export type ConfigInput = z.input<typeof configSchema>;

export class ConfigError {
  constructor(
    public rawConfig: unknown,
    public issues: ZodIssue[],
  ) {}

  private normalizePath(path: (string | number)[]) {
    // shrink the path if the target does not exist
    let validUntil = 0;
    let current = this.rawConfig;

    for (const part of path) {
      if (typeof current === 'object' && current && part in current) {
        // @ts-expect-error - we know that current is an object
        current = current[part];
        validUntil++;
      }
    }

    return path.slice(0, validUntil);
  }

  getIssuesByPath() {
    const issuesByPath: Record<
      string,
      { issues: ZodIssue[]; path: (string | number)[] }
    > = {};
    const self = this;

    (function reduce(issues: ZodIssue[]) {
      for (const issue of issues) {
        if (issue.code !== 'invalid_union') {
          const normalizedPath =
            issue.code === 'unrecognized_keys' && issue.keys[0]
              ? self.normalizePath([...issue.path, issue.keys[0]])
              : self.normalizePath(issue.path);
          const pathStr = normalizedPath.join('.');

          if (!issuesByPath[pathStr]) {
            issuesByPath[pathStr] = {
              path: normalizedPath,
              issues: [],
            };
          }

          issuesByPath[pathStr].issues.push(issue);
        } else {
          for (const error of issue.unionErrors) {
            reduce(error.issues);
          }
        }
      }
    })(this.issues);

    return issuesByPath;
  }
}

export async function loadConfig(path: string) {
  const rawConfig = (await import(path)).default;
  const parseResult = await configSchema.safeParseAsync(rawConfig);

  if (parseResult.success) {
    return parseResult.data;
  }

  throw new ConfigError(rawConfig, parseResult.error.issues);
}
