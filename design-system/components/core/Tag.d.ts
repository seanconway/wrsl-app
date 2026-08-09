import * as React from 'react';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** Renders a remove affordance. */
  onRemove?: (e: React.MouseEvent) => void;
  selected?: boolean;
}
export declare function Tag(props: TagProps): JSX.Element;
