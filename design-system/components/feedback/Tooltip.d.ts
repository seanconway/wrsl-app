import * as React from 'react';

export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
