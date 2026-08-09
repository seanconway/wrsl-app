import * as React from 'react';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  /** Shown below the control in muted text. */
  hint?: React.ReactNode;
  /** Replaces the hint and turns it red. Errors state what happened, then what to do. */
  error?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  children?: React.ReactNode;
}
export declare function Field(props: FieldProps): JSX.Element;
