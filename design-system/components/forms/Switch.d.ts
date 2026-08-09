import * as React from 'react';

export interface SwitchProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
}
export declare function Switch(props: SwitchProps): JSX.Element;
