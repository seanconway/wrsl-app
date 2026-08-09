import * as React from 'react';

/**
 * Primary action control.
 * @startingPoint section="Core" subtitle="Buttons, icon buttons, sizes and states" viewport="700x220"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** primary = lime. One per view. danger is reserved for DQ / delete / end match. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** glove (64px) is mandatory for controls pressed during a live match. */
  size?: 'sm' | 'md' | 'lg' | 'glove';
  /** Lucide icon name. */
  iconLeft?: string;
  iconRight?: string;
  block?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
