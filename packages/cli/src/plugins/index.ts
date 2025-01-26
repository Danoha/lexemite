import type z from 'zod';
import type { Engine } from '../engine.ts';

// biome-ignore lint/suspicious/noExplicitAny: This is a plugin interface, it's fine.
interface PluginClass<T = any> {
  schema: z.Schema<T>;
  new (
    options: T,
  ): {
    apply(engine: Engine): void;
  };
}

export const plugins = {
  entry: async () => (await import('./EntryPlugin.ts')).EntryPlugin,
  files: async () => (await import('./FilesPlugin.ts')).FilesPlugin,
  javascript: async () =>
    (await import('./JavaScriptPlugin.ts')).JavaScriptPlugin,
  nodeResolver: async () =>
    (await import('./NodeResolverPlugin.ts')).NodeResolverPlugin,
  tests: async () => (await import('./TestsPlugin.ts')).TestsPlugin,
  typescript: async () =>
    (await import('./TypeScriptPlugin.ts')).TypeScriptPlugin,
  zombie: async () => (await import('./ZombiePlugin.ts')).ZombiePlugin,
} satisfies Record<string, () => Promise<PluginClass>>;
