import path from 'node:path';
import chalk from 'chalk';
import packageJson from 'lexemite/package.json' with { type: 'json' };
import minimist from 'minimist';
import { ConfigError, loadConfig } from './config.ts';
import { Engine, type Issue } from './engine.ts';
import { sys } from './host.ts';
import { findNode, parseJson } from './languages/json.ts';
import { IssuesPlugin, printIssue } from './plugins/IssuesPlugin.ts';

const args = minimist(process.argv.slice(2), {
  string: ['config'],
  alias: { c: 'config' },
});

// biome-ignore lint/complexity/useLiteralKeys: Required by TS.
const configArg = args['config'] ?? 'lexemite.config.js';

console.log(chalk.green.underline(`Lexemite v${packageJson.version}`));
console.log(chalk.dim(`Using config file: ${configArg}`));

const configPath = path.resolve(configArg);

process.chdir(path.dirname(configPath));

const baseDir = path.resolve('.');
const engine = new Engine(sys);
const configFileNode = engine.file(configPath);

const config = await loadConfig(configPath).catch((error) => {
  if (!(error instanceof ConfigError)) {
    throw error;
  }

  const issuesByPath = error.getIssuesByPath();
  const prettyConfigSource = JSON.stringify(error.rawConfig, null, 2);
  const prettyConfig = parseJson(prettyConfigSource);

  for (const { issues, path } of Object.values(issuesByPath)) {
    console.log();
    const issue: Issue = {
      code: 'invalid-config',
      description: 'Invalid configuration',
      syntaxNode: findNode(prettyConfig, path),
      level: 'error',
      help: issues.map((issue) => issue.message).join('\n'),
    };

    printIssue(engine, configFileNode, issue);
  }

  console.log(`\nFound ${Object.keys(issuesByPath).length} issue(s)`);
  process.exit(1);
});

for (const plugin of config.plugins) {
  plugin.apply(engine);
}

new IssuesPlugin().apply(engine);

engine.addDependency(engine.rootNode, configFileNode);

engine.hooks.readFile.intercept({
  name: 'cli',
  call: (node) => {
    const metaPath = node.meta?.path as string | undefined;

    if (typeof metaPath === 'string') {
      console.log(chalk.dim(`  read ${path.relative(baseDir, metaPath)}`));
    }
  },
});

engine.hooks.done.withOptions({ stage: -100 }).tap('cli', () => {
  const countByType: Record<string, number> = {};
  let totalCount = 0;

  for (const node of engine.rootNode.walk()) {
    if (!node.isReal) {
      continue;
    }

    countByType[node.type] = (countByType[node.type] ?? 0) + 1;
    totalCount += 1;
  }

  console.log(
    chalk.dim(
      `\n 🔗 ${totalCount} node(s), ${Object.keys(countByType).length} type(s)`,
    ),
  );
  for (const [type, count] of Object.entries(countByType)) {
    console.log(chalk.dim(`    ${type}: ${count} node(s)`));
  }
  console.log('');
});

console.log(chalk.green.dim('Initializing...'));
await engine.hooks.initialize.promise(engine);
console.log(chalk.green.dim('Building graph...'));
await engine.hooks.buildGraph.promise(engine);
console.log(chalk.green.dim('Analyzing...'));
await engine.hooks.analyzeGraph.promise(engine);
console.log(chalk.green.dim('Finishing...'));
await engine.hooks.done.promise(engine);

console.log(chalk.green('\n ✨ Done!\n'));
