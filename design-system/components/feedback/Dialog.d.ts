import * as React from 'react';

export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  onClose?: () => void;
  /** Right-aligned action row. Confirm button last. */
  footer?: React.ReactNode;
  width?: number;
  /** Adds the 3px red top edge — DQ, delete, end match. */
  danger?: boolean;
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
