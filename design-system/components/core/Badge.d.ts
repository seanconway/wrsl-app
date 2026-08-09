import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** red/green are athlete corners — never use them for UI state. */
  tone?: 'neutral' | 'live' | 'go' | 'warn' | 'stop' | 'info' | 'red' | 'green';
  /** Filled dot before the label, for status. */
  dot?: boolean;
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
