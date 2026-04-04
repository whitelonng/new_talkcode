export class NoSuchToolError extends Error {
  toolName: string;
  availableTools: string[];

  constructor(toolName: string, availableTools: string[]) {
    super(`No such tool: ${toolName}`);
    this.name = 'NoSuchToolError';
    this.toolName = toolName;
    this.availableTools = availableTools;
  }

  static isInstance(error: unknown): error is NoSuchToolError {
    return error instanceof NoSuchToolError;
  }
}

export class InvalidToolInputError extends Error {
  toolName: string;
  toolInput: unknown;

  constructor(toolName: string, toolInput: unknown, message?: string) {
    super(message ?? `Invalid input for tool: ${toolName}`);
    this.name = 'InvalidToolInputError';
    this.toolName = toolName;
    this.toolInput = toolInput;
  }

  static isInstance(error: unknown): error is InvalidToolInputError {
    return error instanceof InvalidToolInputError;
  }
}
