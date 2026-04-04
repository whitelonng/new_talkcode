import * as React from 'react';
import type { LegendPayload } from 'recharts/types/component/DefaultLegendContent';
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
    theme?: {
      light: string;
      dark: string;
    };
  }
>;

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: ChartConfig;
}

export function ChartContainer({ config, className, children, ...props }: ChartContainerProps) {
  const style = React.useMemo<React.CSSProperties>(() => {
    if (!config) return {};
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        `--color-${key}`,
        value.color ?? value.theme?.dark ?? value.theme?.light,
      ])
    ) as React.CSSProperties;
  }, [config]);

  return (
    <div
      className={cn(
        '[&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/40',
        '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
        '[&_.recharts-tooltip-cursor]:fill-muted/40',
        '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/40',
        'w-full rounded-md border bg-card text-card-foreground',
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ReadonlyArray<Payload<ValueType, NameType>>;
  label?: string | number;
  indicator?: 'line' | 'dot' | 'dashed';
  hideLabel?: boolean;
  labelFormatter?: (label: string | number) => React.ReactNode;
  valueFormatter?: (
    value: ValueType,
    name: NameType,
    entry: Payload<ValueType, NameType>
  ) => React.ReactNode;
  className?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  indicator = 'dot',
  hideLabel,
  labelFormatter,
  valueFormatter,
  className,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-md border bg-background/95 p-2 text-xs text-foreground shadow-sm',
        className
      )}
    >
      {!hideLabel && (
        <div className="mb-1 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label ?? '') : label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item: Payload<ValueType, NameType>, index: number) => {
          const indicatorClass =
            indicator === 'line'
              ? 'h-0.5 w-3'
              : indicator === 'dashed'
                ? 'h-0.5 w-3 border border-dashed'
                : 'h-2 w-2 rounded-full';
          const indicatorColor = item.color ?? 'var(--color-chart-1)';

          return (
            <div
              key={item.dataKey?.toString() ?? item.name?.toString() ?? index}
              className="flex items-center gap-2"
            >
              <span
                className={cn('inline-block', indicatorClass)}
                style={{ backgroundColor: indicatorColor, borderColor: indicatorColor }}
              />
              <span className="text-muted-foreground">{item.name ?? item.dataKey?.toString()}</span>
              <span className="ml-auto text-foreground">
                {valueFormatter
                  ? valueFormatter(item.value as ValueType, item.name ?? '', item)
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartTooltip(props: ChartTooltipContentProps) {
  return <ChartTooltipContent {...props} />;
}

interface ChartLegendProps {
  className?: string;
  payload?: ReadonlyArray<LegendPayload>;
}

export function ChartLegend({ className, payload }: ChartLegendProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)}>
      {(payload ?? []).map((item: LegendPayload) => (
        <div key={item.value as string} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color ?? 'var(--color-chart-1)' }}
          />
          <span className="text-muted-foreground">{item.value ?? item.dataKey?.toString()}</span>
        </div>
      ))}
    </div>
  );
}
