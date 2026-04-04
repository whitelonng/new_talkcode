import Editor, { type Monaco, useMonaco } from '@monaco-editor/react';
import { readFile } from '@tauri-apps/plugin-fs';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { editor } from 'monaco-editor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EDITOR_OPTIONS } from '@/constants/editor';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/lib/logger';
import { createTextModelService } from '@/services/monaco-text-model-service';
import { repositoryService } from '@/services/repository-service';
import { setupMonacoDiagnostics, setupMonacoTheme } from '@/utils/monaco-utils';

// Image file extensions with MIME types
const IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

// Binary file extensions
const BINARY_EXTENSIONS = [
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'a',
  'lib',
  'o',
  'obj',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'tar',
  'gz',
  'bz2',
  '7z',
  'rar',
  'mp3',
  'mp4',
  'avi',
  'mkv',
  'mov',
  'wmv',
  'flv',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'eot',
  'jar',
  'war',
  'ear',
  'class',
  'pyc',
  'pyo',
  'db',
  'sqlite',
  'sqlite3',
  'lock',
  'lockb',
];

function getFileExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(filePath: string): boolean {
  return getFileExtension(filePath) in IMAGE_EXTENSIONS;
}

function isBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.includes(getFileExtension(filePath));
}

// Image preview component
function ImagePreview({ filePath }: { filePath: string }) {
  const fileName = filePath.split('/').pop() || filePath;
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const ext = getFileExtension(filePath);
        const mimeType = IMAGE_EXTENSIONS[ext] || 'image/png';
        const data = await readFile(filePath);
        const base64 = btoa(String.fromCharCode(...data));
        setImageSrc(`data:${mimeType};base64,${base64}`);
        setError(null);
      } catch (err) {
        logger.error('Failed to load image:', filePath, err);
        setError('Failed to load image');
      }
    };
    loadImage();
  }, [filePath]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-4">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted/30 p-4">
      <img alt={fileName} className="max-h-full max-w-full object-contain" src={imageSrc} />
    </div>
  );
}

// Binary file warning component
function BinaryFileWarning({ onOpenAnyway }: { onOpenAnyway: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/30 p-4">
      <AlertTriangle className="h-16 w-16 text-yellow-500" />
      <p className="text-center text-muted-foreground">
        The file is not displayed in the text editor because it is either binary or uses an
        unsupported text encoding.
      </p>
      <Button variant="default" onClick={onOpenAnyway}>
        Open Anyway
      </Button>
    </div>
  );
}

interface FileEditorContentProps {
  filePath: string;
  currentContent: string;
  onContentChange: (value: string | undefined) => void;
  onEditorDidMount: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void;
  onSave: () => void;
}

export function FileEditorContent({
  filePath,
  currentContent,
  onContentChange,
  onEditorDidMount,
  onSave,
}: FileEditorContentProps) {
  const fileName = repositoryService.getFileNameFromPath(filePath);
  const language = repositoryService.getLanguageFromExtension(fileName);
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [forceOpenBinary, setForceOpenBinary] = useState(false);

  // Reset forceOpenBinary when file changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset state when filePath changes
  useEffect(() => {
    setForceOpenBinary(false);
  }, [filePath]);

  // Check file type
  const isImage = isImageFile(filePath);
  const isBinary = isBinaryFile(filePath);

  // Use useMonaco hook to get Monaco instance before editor renders
  // This allows us to create overrideServices with the Monaco instance
  const monacoFromHook = useMonaco();

  // Create overrideServices for cross-file peek widget support
  // This is required because Monaco standalone mode cannot resolve models by URI
  // See: https://github.com/microsoft/monaco-editor/issues/935
  const overrideServices = useMemo(() => {
    if (!monacoFromHook) {
      logger.info('[TextModelService] Monaco not yet loaded, overrideServices will be empty');
      return {};
    }
    logger.info('[TextModelService] Creating textModelService with Monaco instance');
    return {
      textModelService: createTextModelService(monacoFromHook),
    };
  }, [monacoFromHook]);

  // Handle theme changes
  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      const theme = resolvedTheme === 'light' ? 'light-ai' : 'vs-dark-ai';
      logger.info('Setting Monaco theme to:', theme);

      // Force update the theme using Monaco API
      monacoRef.current.editor.setTheme(theme);

      // Also trigger a layout update to ensure rendering
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 0);
    }
  }, [resolvedTheme]);

  // Listen for global theme change events to keep Monaco in sync
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        resolvedTheme?: 'light' | 'dark';
      };
      const rt = detail?.resolvedTheme;
      if (!(rt && monacoRef.current)) return;
      const theme = rt === 'light' ? 'light-ai' : 'vs-dark-ai';
      logger.info('Monaco receiving theme-changed event ->', theme);
      // Make sure themes are defined; in case of fresh load
      setupMonacoTheme(rt, monacoRef.current);
      monacoRef.current.editor.setTheme(theme);
      editorRef.current?.layout();
    };
    window.addEventListener('theme-changed', handler as EventListener);
    return () => window.removeEventListener('theme-changed', handler as EventListener);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Setup custom themes with AI suggestion support using the actual Monaco instance
    setupMonacoTheme(resolvedTheme, monaco);

    // Set initial theme immediately after mount
    const theme = resolvedTheme === 'light' ? 'light-ai' : 'vs-dark-ai';
    monaco.editor.setTheme(theme);

    // Setup diagnostics for the current model
    const model = editor.getModel();
    if (model) {
      setupMonacoDiagnostics(model, monaco);
    }

    onEditorDidMount(editor, monaco);
  };

  // Render image preview for image files
  if (isImage) {
    return (
      <div className="min-h-0 flex-1">
        <ImagePreview filePath={filePath} />
      </div>
    );
  }

  // Render binary file warning (unless user chose to open anyway)
  if (isBinary && !forceOpenBinary) {
    return (
      <div className="min-h-0 flex-1">
        <BinaryFileWarning onOpenAnyway={() => setForceOpenBinary(true)} />
      </div>
    );
  }

  // Render Monaco editor for text files
  return (
    <div className="min-h-0 flex-1">
      <Editor
        key={resolvedTheme}
        path={filePath}
        className="h-full"
        language={language}
        loading={false}
        onChange={onContentChange}
        beforeMount={(monaco) => {
          // Ensure themes exist before the editor is created
          monacoRef.current = monaco;
          setupMonacoTheme(resolvedTheme, monaco);

          // Enable TypeScript/JavaScript diagnostics globally before editor mounts
          setupMonacoDiagnostics(null, monaco);
        }}
        onMount={handleEditorDidMount}
        options={EDITOR_OPTIONS}
        overrideServices={overrideServices}
        theme={resolvedTheme === 'light' ? 'light-ai' : 'vs-dark-ai'}
        value={currentContent}
      />
    </div>
  );
}
