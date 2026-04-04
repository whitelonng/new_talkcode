import { GenericToolDoing } from './generic-tool-doing';

interface ExecuteSkillScriptDoingProps {
  script_path: string;
  script_type: string;
}

export function ExecuteSkillScriptDoing({
  script_path,
  script_type,
}: ExecuteSkillScriptDoingProps) {
  const fileName = script_path.split('/').pop() || script_path;
  return (
    <GenericToolDoing
      type="script"
      operation="execute"
      target={`${fileName} (${script_type})`}
      details="Skill Script"
    />
  );
}
