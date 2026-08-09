import * as React from 'react';

export interface NamePlateProps extends React.HTMLAttributes<HTMLDivElement> {
  corner?: 'red' | 'green' | 'white';
  /** "Surname, Firstname" — set ALL CAPS by the component. */
  name?: React.ReactNode;
  team?: React.ReactNode;
  seed?: number;
  /** sm 16 · md 25 · lg 39 · mat 62 px */
  size?: 'sm' | 'md' | 'lg' | 'mat';
}
export declare function NamePlate(props: NamePlateProps): JSX.Element;
