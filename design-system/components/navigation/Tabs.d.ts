import * as React from 'react';

export interface TabItem { value: string; label: React.ReactNode; icon?: string; count?: number }

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** underline = page-level sections · segmented = in-card filters. */
  variant?: 'underline' | 'segmented';
}
export declare function Tabs(props: TabsProps): JSX.Element;
