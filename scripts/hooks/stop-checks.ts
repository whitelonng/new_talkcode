import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';

type StopHookInput = {
  cwd?: string;
  stop_hook_active?: boolean;
};

const MAX_LINES = 80;
const MAX_CHARS = 8000;

function tailLines(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) {
    return text.trim();
  }
  return lines.slice(-maxLines).join('\n').trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + '\n... (truncated)';
}

function formatFailure(
  label: string,
  detail: string,
  stdout?: string,
  stderr?: string
): string {
  let message = `Stop hook failed: ${label}\n${detail}`;

  if (stdout?.trim()) {
    message += `\n--- stdout ---\n${tailLines(stdout, MAX_LINES)}`;
  }

  if (stderr?.trim()) {
    message += `\n--- stderr ---\n${tailLines(stderr, MAX_LINES)}`;
  }

  return truncate(message, MAX_CHARS);
}

function emitBlock(reason: string): void {
  const output = JSON.stringify({ decision: 'block', reason });
  process.stdout.write(output);
}

function readInput(): StopHookInput {
  try {
    const raw = readFileSync(0, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw) as StopHookInput;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    emitBlock(`Stop hook failed to parse input: ${reason}`);
    process.exit(0);
  }
}

function runCommand(label: string, cwd: string): string | null {
  const [cmd, ...args] = label.split(' ');
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
  });

  if (result.error) {
    return formatFailure(
      label,
      `Failed to start command: ${result.error.message}`,
      result.stdout,
      result.stderr
    );
  }

  if (result.status !== 0) {
    const detail = `Exit code: ${result.status ?? 'unknown'}`;
    return formatFailure(label, detail, result.stdout, result.stderr);
  }

  return null;
}

const input = readInput();

const cwd = input.cwd || process.env.TALKCODY_PROJECT_DIR || process.cwd();
try {
  process.chdir(cwd);
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown error';
  emitBlock(`Stop hook failed to change directory to ${cwd}: ${reason}`);
  process.exit(0);
}

const commands = ['bun run tsc', 'bun run test', 'bun run lint'];
for (const command of commands) {
  const failure = runCommand(command, cwd);
  if (failure) {
    emitBlock(failure);
    process.exit(0);
  }
}