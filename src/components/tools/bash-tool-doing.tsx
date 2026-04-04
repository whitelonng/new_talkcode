import { GenericToolDoing } from './generic-tool-doing';

interface BashToolDoingProps {
  command: string;
}

export function BashToolDoing({ command }: BashToolDoingProps) {
  return <GenericToolDoing type="bash" operation="execute" target={command} details="Command" />;
}
