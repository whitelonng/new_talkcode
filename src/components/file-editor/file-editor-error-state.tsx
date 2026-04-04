import { AlertCircle } from 'lucide-react';

interface FileEditorErrorStateProps {
  error: string;
}

export function FileEditorErrorState({ error }: FileEditorErrorStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center text-red-500">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 h-16 w-16" />
        <p className="font-medium">Failed to load file</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    </div>
  );
}
