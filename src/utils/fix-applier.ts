import type { editor } from 'monaco-editor';

import { logger } from '@/lib/logger';
import type { LintDiagnostic } from '@/services/lint-service';

/**
 * Escape special characters in a string for use in a regular expression
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface FixApplierOptions {
  editor: editor.IStandaloneCodeEditor | editor.ICodeEditor | null;
  filePath: string;
}

export class FixApplier {
  private editor: editor.IStandaloneCodeEditor | editor.ICodeEditor | null;
  private filePath: string;
  private t: any; // Translation function

  constructor({ editor, filePath }: FixApplierOptions) {
    this.editor = editor;
    this.filePath = filePath;
    // Initialize translation function - will be set when applyFix is called
    this.t = null;
  }

  /**
   * Apply a specific fix to a diagnostic
   */
  async applyFix(diagnostic: LintDiagnostic, fixId: string, translationFn?: any): Promise<boolean> {
    // Set translation function if provided
    if (translationFn) {
      this.t = translationFn;
    }

    // Fallback if no translation function is provided
    if (!this.t) {
      this.t = {
        Lint: {
          FixApplier: {
            editorNotReady: 'Editor not ready',
            editorModelNotReady: 'Editor model not ready',
            unknownFixType: (fixId: string) => `Unknown fix type: ${fixId}`,
          },
        },
      };
    }
    if (!this.editor || !this.editor.getModel()) {
      throw new Error(this.t.Lint.FixApplier.editorNotReady);
    }

    const model = this.editor.getModel();
    if (!model) {
      throw new Error(this.t.Lint.FixApplier.editorModelNotReady);
    }
    const content = model.getValue();
    let newContent = content;
    let hasChanges = false;

    try {
      switch (fixId) {
        case 'remove-variable':
          newContent = this.removeUnusedVariable(content, diagnostic);
          break;

        case 'remove-imports':
          newContent = this.removeUnusedImports(content, diagnostic);
          break;

        case 'convert-to-const':
          newContent = this.convertToConst(content, diagnostic);
          break;

        case 'add-comment':
          newContent = this.addEmptyFunctionComment(content, diagnostic);
          break;

        case 'ignore-diagnostic':
          newContent = this.addIgnoreComment(content, diagnostic);
          break;

        case 'add-type-annotation':
          newContent = this.addTypeAnnotation(content, diagnostic);
          break;

        default:
          throw new Error(this.t.Lint.FixApplier.unknownFixType(fixId));
      }

      // Only mark as changed if content actually changed
      hasChanges = newContent !== content;

      if (hasChanges) {
        // Apply the changes to the editor
        const fullRange = model.getFullModelRange();
        this.editor.executeEdits('lint-fix', [
          {
            range: fullRange,
            text: newContent,
            forceMoveMarkers: true,
          },
        ]);

        logger.info('Applied fix:', fixId, 'to diagnostic:', diagnostic.id);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to apply fix:', fixId, error);
      throw error;
    }
  }

  /**
   * Remove unused variable
   */
  private removeUnusedVariable(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      // Simple pattern matching for variable declarations
      const match = line.match(/(?:const|let|var)\s+(\w+)\s*[=:]/);
      if (match && match[1]) {
        const varName = match[1];
        // Remove the entire line if it's a simple variable declaration
        if (
          line.trim().startsWith(`const ${varName}`) ||
          line.trim().startsWith(`let ${varName}`) ||
          line.trim().startsWith(`var ${varName}`)
        ) {
          lines.splice(start.line - 1, 1);
        } else {
          // Remove just the variable name and assignment
          // Escape varName to prevent regex injection
          const escapedVarName = escapeRegExp(varName);
          const newLine = line.replace(new RegExp(`\\b${escapedVarName}\\b[^;]*;?`), '').trim();
          if (newLine) {
            lines[start.line - 1] = newLine;
          } else {
            lines.splice(start.line - 1, 1);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Remove unused imports
   */
  private removeUnusedImports(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      // Remove entire import statement
      if (line.trim().startsWith('import ')) {
        lines.splice(start.line - 1, 1);
      } else {
        // Try to match and remove import line
        const importMatch = line.match(/import\s+.*\s+from\s+['"][^'"]+['"]/);
        if (importMatch) {
          lines.splice(start.line - 1, 1);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert variable to const
   */
  private convertToConst(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      const newLine = line.replace(/\b(let|var)\b/, 'const');
      lines[start.line - 1] = newLine;
    }

    return lines.join('\n');
  }

  /**
   * Add comment to empty function
   */
  private addEmptyFunctionComment(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      const indentedContent = line.match(/^(\s*)/)?.[1] || '';
      const commentLine = `${indentedContent}// TODO: Implement function\n`;
      lines.splice(start.line, 0, commentLine);
    }

    return lines.join('\n');
  }

  /**
   * Add ignore comment for diagnostic
   */
  private addIgnoreComment(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      const indentedContent = line.match(/^(\s*)/)?.[1] || '';
      const ignoreComment = `${indentedContent}// biome-ignore ${diagnostic.code}: ${diagnostic.message}`;
      // Insert before the current line (line numbers are 1-indexed, so start.line - 1 is correct)
      lines.splice(start.line - 1, 0, ignoreComment);
    }

    return lines.join('\n');
  }

  /**
   * Add type annotation for explicit any
   */
  private addTypeAnnotation(content: string, diagnostic: LintDiagnostic): string {
    const lines = content.split('\n');
    const { start, end } = diagnostic.range;

    if (start.line <= lines.length && start.line > 0) {
      const line = lines[start.line - 1];
      if (!line) return content;
      const lineContent = line.substring(0, Math.max(0, (end.column || 1) - 1));
      const afterContent = line.substring(Math.max(0, (end.column || 1) - 1));

      // Add unknown type annotation
      const newLine = `${lineContent}: unknown${afterContent}`;
      lines[start.line - 1] = newLine;
    }

    return lines.join('\n');
  }
}

/**
 * Factory function to create a fix applier
 */
export function createFixApplier(options: FixApplierOptions): FixApplier {
  return new FixApplier(options);
}
