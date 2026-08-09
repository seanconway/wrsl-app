import * as React from 'react';

export interface NavRailItem { value: string; label: React.ReactNode; icon?: string; badge?: React.ReactNode }

/**
 * Fixed left navigation for the Console.
 * @startingPoint section="Console" subtitle="Dark left rail with lime active edge" viewport="700x260"
 */
export interface NavRailProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  items: NavRailItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** Shows the RefRemote wordmark at the top. */
  brand?: boolean;
  footer?: React.ReactNode;
}
export declare function NavRail(props: NavRailProps): JSX.Element;
