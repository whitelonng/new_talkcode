import { readTextFile } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import { logger } from '@/lib/logger';
import { repositoryService } from './repository-service';

/**
 * Creates a custom textModelService that allows Monaco's peek widget
 * to resolve models across different files.
 *
 * This is required because Monaco Editor standalone mode's default
 * textModelService cannot find models by URI, which breaks peek
 * references and peek definition for cross-file navigation.
 *
 * See: https://github.com/microsoft/monaco-editor/issues/935
 */
export function createTextModelService(monaco: typeof Monaco) {
  return {
    createModelReference: async (uri: Monaco.Uri) => {
      logger.info('[TextModelService] createModelReference called for:', uri.toString());

      let model = monaco.editor.getModel(uri);

      // If model doesn't exist, try to create it from file
      if (!model) {
        try {
          const filePath = uri.path;
          logger.info('[TextModelService] Model not found, loading from file:', filePath);

          const content = await readTextFile(filePath);
          const fileName = repositoryService.getFileNameFromPath(filePath);
          const language = repositoryService.getLanguageFromExtension(fileName);

          model = monaco.editor.createModel(content, language, uri);
          logger.info('[TextModelService] Created model for:', filePath, 'language:', language);
        } catch (error) {
          logger.error('[TextModelService] Failed to load model for:', uri.toString(), error);
          throw new Error(`Cannot load model for ${uri.toString()}`);
        }
      } else {
        logger.info('[TextModelService] Found existing model for:', uri.toString());
      }

      return {
        object: {
          textEditorModel: model,
        },
        dispose: () => {
          // Don't dispose the model here - it may be reused
        },
      };
    },
  };
}
