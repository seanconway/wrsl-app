import * as React from 'react';

export interface MatTileAthlete { name: string; points: number }

/**
 * One mat's live state in the Console overview grid.
 * @startingPoint section="Console" subtitle="Mat overview tile with live score and clock" viewport="700x240"
 */
export interface MatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  mat: number | string;
  status?: 'live' | 'idle' | 'paused' | 'down';
  /** Mono uppercase, e.g. "ADULT BLUE · −76KG". */
  division?: React.ReactNode;
  /** Pre-formatted M:SS. */
  clock?: string;
  red?: MatTileAthlete;
  green?: MatTileAthlete;
  /** Matches waiting on this mat. */
  queued?: number;
}
export declare function MatTile(props: MatTileProps): JSX.Element;
