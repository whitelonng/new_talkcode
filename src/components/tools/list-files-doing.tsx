import { GenericToolDoing } from './generic-tool-doing';

interface ListFilesDoingProps {
  path: string;
  depth?: number;
}

export function ListFilesDoing({ path, depth }: ListFilesDoingProps) {
  const details = depth ? `Depth: ${depth}` : undefined;

  return <GenericToolDoing type="list" operation="list" target={path} details={details} />;
}
