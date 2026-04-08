export function isTerminalCopyShortcut(event: KeyboardEvent): boolean {
  const hasModifier = event.ctrlKey || event.metaKey;
  return hasModifier && !event.altKey && event.key.toLowerCase() === 'c';
}

export async function copyTerminalSelection(
  selection: string,
  clipboard: Pick<Clipboard, 'writeText'>
): Promise<boolean> {
  if (!selection.trim()) {
    return false;
  }

  await clipboard.writeText(selection);
  return true;
}
