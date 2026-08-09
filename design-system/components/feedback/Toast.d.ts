import * as React from 'react';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'go' | 'warn' | 'stop';
  title?: React.ReactNode;
  /** Second line: what the system did and what the operator can do. */
  detail?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
}
export declare function Toast(props: ToastProps): JSX.Element;
