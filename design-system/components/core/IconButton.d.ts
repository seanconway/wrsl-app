import * as React from 'react';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Lucide icon name. */
  icon: string;
  /** Required — becomes aria-label and the native tooltip. */
  label: string;
  variant?: 'ghost' | 'outline' | 'solid';
  size?: 'sm' | 'md' | 'lg' | 'glove';
  /** Selected/armed state — fills with lime. */
  active?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
