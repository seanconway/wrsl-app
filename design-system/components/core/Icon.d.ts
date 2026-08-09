import * as React from 'react';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name, kebab-case (e.g. "circle-dot"). See readme.md for the working set. */
  name: string;
  /** 16 inline · 20 buttons/rows · 24 rails/headers · 32+ matside status. */
  size?: 16 | 20 | 24 | 32 | 40 | 56;
  /** Defaults to currentColor. Only --signal-* and athlete colours may override. */
  color?: string;
  /** Accessible name. Required when the icon is the only content of a control. */
  label?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
