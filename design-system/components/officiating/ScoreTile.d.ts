import * as React from 'react';

export interface ScoreTileProps extends React.HTMLAttributes<HTMLDivElement> {
  corner?: 'red' | 'green' | 'white';
  points?: number;
  /** Counted separately — never folded into points. */
  advantages?: number;
  penalties?: number;
  /** sm 39 · md 78 · lg 148 · mat 220 px */
  size?: 'sm' | 'md' | 'lg' | 'mat';
  /** 140 ms lime wash after a score is registered. */
  flash?: boolean;
}
export declare function ScoreTile(props: ScoreTileProps): JSX.Element;
