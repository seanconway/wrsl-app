import * as React from 'react';

export interface SelectOption { value: string; label: string }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'size' | 'style'> {
  value?: string;
  onChange?: (value: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: Array<string | SelectOption>;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
}
export declare function Select(props: SelectProps): JSX.Element;
