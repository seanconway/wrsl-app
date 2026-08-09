import * as React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size' | 'style'> {
  value?: string | number;
  /** Receives the raw string, then the event. */
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  /** Lucide icon rendered inside the left edge. */
  icon?: string;
  invalid?: boolean;
  /** Use for IDs, times and any value with fixed character positions. */
  mono?: boolean;
}
export declare function Input(props: InputProps): JSX.Element;
