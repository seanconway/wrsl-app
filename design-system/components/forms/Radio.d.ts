import * as React from 'react';

export interface RadioProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange'> {
  name: string;
  value: string;
  checked?: boolean;
  onChange?: (value: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}
export declare function Radio(props: RadioProps): JSX.Element;
