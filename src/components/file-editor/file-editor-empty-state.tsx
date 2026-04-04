import { FileText } from 'lucide-react';

export function FileEditorEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center text-gray-500">
      <div className="text-center">
        <FileText className="mx-auto mb-4 h-16 w-16 opacity-50" />
        <p>Select a file to view and edit its content</p>
      </div>
    </div>
  );
}
