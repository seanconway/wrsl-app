import * as React from 'react';

export interface PenaltyPipsProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
  /** Slots shown. Third penalty is usually disqualifying — default 3. */
  max?: number;
  /** penalty = amber squares · advantage = ink circles. */
  kind?: 'penalty' | 'advantage';
  size?: number;
  label?: React.ReactNode;
}
export declare function PenaltyPips(props: PenaltyPipsProps): JSX.Element;
