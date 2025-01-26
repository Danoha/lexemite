import chalk from 'chalk';
import { z } from 'zod';
import type { Engine, Issue, Node } from '../engine.ts';

export class IssuesPlugin {
  schema = z.never();

  apply(engine: Engine) {
    engine.hooks.done.tap('IssuesPlugin', () => {
      const issues = [...engine.getIssues()];

      issues.sort(([, a], [, b]) => {
        // warnings first
        const aIsWarning = a.level === 'warning';
        const bIsWarning = b.level === 'warning';

        if (aIsWarning && !bIsWarning) {
          return -1;
        }
        if (!aIsWarning && bIsWarning) {
          return 1;
        }

        // sort by code
        if (a.code < b.code) {
          return -1;
        }
        if (a.code > b.code) {
          return 1;
        }

        // sort by description
        if (a.description < b.description) {
          return -1;
        }
        if (a.description > b.description) {
          return 1;
        }

        return 0;
      });

      for (const [index, [node, issue]] of issues.entries()) {
        if (index > 0) {
          console.log();
        }

        printIssue(engine, node, issue);
      }

      if (issues.length > 0) {
        console.log();
      }

      console.log(`Found ${issues.length} issue(s)`);
    });
  }
}

export function printIssue(engine: Engine, node: Node, issue: Issue) {
  const { level, code, description, syntaxNode, help, details } = issue;
  const color = level === 'warning' ? 'yellow' : 'red';
  console.log(
    chalk[color].bold.underline(`[${code}] ${level}: ${description}`),
  );

  if (syntaxNode) {
    const { tree, startPosition } = syntaxNode;
    const context = tree.rootNode.text.split('\n');

    // keep 2 lines before and 2 lines after
    const startRow = Math.max(0, startPosition.row - 2);
    const endRow = Math.min(context.length, startPosition.row + 3);

    console.log(
      context
        .slice(startRow, endRow)
        .map((line, index) => {
          const row = startRow + index + 1;
          const prefix = row === startPosition.row + 1 ? '-> ' : '   ';
          return `${prefix}${chalk.dim(row.toString().padStart(4, ' '))} ${chalk.dim('|')} ${row === startPosition.row + 1 ? chalk.bold(line) : line}`;
        })
        .join('\n'),
    );
    console.log(chalk.dim(`  at ${engine.formatNode(node)}`));
  } else {
    console.log();
    console.log(`  ${chalk.bold(engine.formatNode(node))}`);
  }

  if (help) {
    console.log();
    console.log(`  ${chalk.dim.yellow(help.replaceAll('\n', '\n  '))}`);
  }

  if (details?.length) {
    console.log();
    console.log(
      `  ${chalk.dim(details.join('\n\n').replaceAll('\n', '\n  '))}`,
    );
  }
}
