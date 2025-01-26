import type Parser from 'tree-sitter';

export interface ProgramImport {
  node: Parser.SyntaxNode;
  moduleId: string;
  externalSpecifier: string | null;
  localSpecifier: string | null;
}

export interface ProgramExportSelf {
  node: Parser.SyntaxNode;
  source: null;
  exportedSpecifier: string | null;
}

export interface ProgramReexport {
  node: Parser.SyntaxNode;
  source: {
    moduleId: string;
    externalSpecifier: string | null;
  };
  exportedSpecifier: string | null;
}

export type ProgramExport = ProgramExportSelf | ProgramReexport;
