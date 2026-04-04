import { useId } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MODEL_TYPE_DESCRIPTIONS, MODEL_TYPE_LABELS, ModelType } from '@/types/model-types';

interface ModelTypeSelectorProps {
  value?: ModelType;
  onValueChange: (value: ModelType) => void;
  label?: string;
  className?: string;
}

export function ModelTypeSelector({
  value,
  onValueChange,
  label = 'Model Type',
  className,
}: ModelTypeSelectorProps) {
  const selectId = useId();
  return (
    <div className={className}>
      <Label htmlFor={selectId}>{label}</Label>
      <Select value={value || ModelType.MAIN} onValueChange={onValueChange}>
        <SelectTrigger id={selectId} className="w-full">
          <SelectValue placeholder="Select model type" />
        </SelectTrigger>
        <SelectContent>
          {Object.values(ModelType).map((type) => (
            <SelectItem key={type} value={type}>
              <div className="flex flex-col items-start">
                <span className="font-medium">{MODEL_TYPE_LABELS[type]}</span>
                <span className="text-xs text-muted-foreground">
                  {MODEL_TYPE_DESCRIPTIONS[type]}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
