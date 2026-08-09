import * as React from 'react';

/**
 * Match clock in mono tabular figures.
 * @startingPoint section="Matside" subtitle="Clock, score tiles and name plates" viewport="700x300"
 */
export interface MatchClockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remaining seconds. */
  seconds?: number;
  /** Stopped clocks render muted; the component never animates either way. */
  running?: boolean;
  /** sm 21 · md 39 · lg 78 · xl 148 · mat 220 px */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'mat';
  label?: React.ReactNode;
  /** Turns the clock red at or below this many seconds. Default 10. */
  warnUnder?: number;
}
export declare function MatchClock(props: MatchClockProps): JSX.Element;
