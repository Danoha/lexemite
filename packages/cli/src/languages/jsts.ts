import type Parser from 'tree-sitter';
import type { ProgramExport, ProgramImport } from './index.ts';

export function* findImports(tree: Parser.Tree): Generator<ProgramImport> {
  for (const node of tree.rootNode.descendantsOfType('import_statement')) {
    const moduleId = node.childForFieldName('source')?.child(1)?.text;

    if (moduleId === undefined) {
      continue;
    }

    const [importClause] = node.descendantsOfType('import_clause');

    if (!importClause) {
      // side-effect import
      yield { moduleId, node, externalSpecifier: null, localSpecifier: null };
      continue;
    }

    for (const child of importClause.children) {
      if (child.type === 'identifier') {
        yield {
          moduleId,
          node,
          externalSpecifier: 'default',
          localSpecifier: child.text,
        };
        continue;
      }

      if (child.type === 'named_imports') {
        for (const namedImport of child.descendantsOfType('import_specifier')) {
          const name = namedImport.childForFieldName('name')?.text;
          const alias = namedImport.childForFieldName('alias')?.text;

          if (name === undefined) {
            continue;
          }

          yield {
            moduleId,
            node,
            externalSpecifier: name,
            localSpecifier: alias ?? name,
          };
        }
      }
    }
  }

  for (const node of tree.rootNode.descendantsOfType('call_expression')) {
    const callee = node.childForFieldName('function')?.text;
    if (callee !== 'import' && callee !== 'require') {
      continue;
    }
    const firstArgument = node.childForFieldName('arguments')?.firstNamedChild;
    if (firstArgument?.type !== 'string') {
      continue;
    }
    const moduleId = firstArgument.child(1)?.text;
    if (moduleId === undefined) {
      continue;
    }

    yield {
      moduleId,
      node,
      externalSpecifier: null,
      localSpecifier: null,
    };
  }
}
export function* findExports(tree: Parser.Tree): Generator<ProgramExport> {
  for (const node of tree.rootNode.descendantsOfType('export_statement')) {
    const declaration = node.childForFieldName('declaration');

    if (declaration) {
      switch (declaration.type) {
        case 'function_declaration':
        case 'type_alias_declaration':
        case 'interface_declaration':
        case 'class_declaration':
        case 'abstract_class_declaration':
        case 'internal_module':
        case 'enum_declaration': {
          const exportedSpecifier = declaration.childForFieldName('name')?.text;

          if (exportedSpecifier === undefined) {
            continue;
          }

          yield {
            node,
            source: null,
            exportedSpecifier,
          };
          break;
        }

        case 'variable_declaration':
        case 'lexical_declaration': {
          for (const child of declaration.descendantsOfType(
            'variable_declarator',
          )) {
            const name = child.childForFieldName('name')?.text;
            const alias = child.childForFieldName('alias')?.text;

            if (name === undefined) {
              continue;
            }

            yield {
              node,
              source: null,
              exportedSpecifier: alias ?? name,
            };
          }
          break;
        }
      }
      continue;
    }

    const moduleId = node.childForFieldName('source')?.child(1)?.text;
    const [exportClause] = node.descendantsOfType('export_clause');
    const [namespaceExport] = node.descendantsOfType('namespace_export');

    if (exportClause) {
      for (const namedExport of exportClause.descendantsOfType(
        'export_specifier',
      )) {
        const name = namedExport.childForFieldName('name')?.text;
        const alias = namedExport.childForFieldName('alias')?.text;

        if (name === undefined) {
          continue;
        }

        yield {
          node,
          source:
            moduleId !== undefined
              ? { moduleId, externalSpecifier: name }
              : null,
          exportedSpecifier: alias ?? name,
        };
      }
    }

    if (namespaceExport) {
      const [identifier] = namespaceExport.descendantsOfType('identifier');
      const exportedSpecifier = identifier?.text;

      if (exportedSpecifier === undefined) {
        continue;
      }

      yield {
        node,
        source:
          moduleId !== undefined ? { moduleId, externalSpecifier: null } : null,
        exportedSpecifier,
      };
    }

    if (!exportClause && !namespaceExport) {
      yield {
        node,
        source:
          moduleId !== undefined ? { moduleId, externalSpecifier: null } : null,
        exportedSpecifier: null,
      };
    }
  }
}
