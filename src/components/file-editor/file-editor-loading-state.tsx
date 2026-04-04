export function FileEditorLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
        <p>Loading file content...</p>
      </div>
    </div>
  );
}
