import { GenericToolDoing } from './generic-tool-doing';

interface SearchToolDoingProps {
  query: string;
}

export function SearchToolDoing({ query }: SearchToolDoingProps) {
  return <GenericToolDoing type="search" operation="search" target={query} details="Keywords" />;
}
