import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  /** Mono uppercase label above the title. */
  eyebrow?: React.ReactNode;
  /** Right-aligned controls in the header. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: number;
  interactive?: boolean;
  /** Draws the 3px lime selection edge. */
  selected?: boolean;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
