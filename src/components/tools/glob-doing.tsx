import { GenericToolDoing } from './generic-tool-doing';

interface GlobDoingProps {
  pattern: string;
  path?: string;
}

export function GlobDoing({ pattern, path }: GlobDoingProps) {
  const target = path ? `${path}/${pattern}` : pattern;
  const details = `Pattern: ${pattern}${path ? ` in ${path}` : ''}`;

  return <GenericToolDoing type="glob" operation="find" target={target} details={details} />;
}
