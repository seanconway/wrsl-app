import * as React from 'react';

/**
 * Radio link + battery state for one remote or display.
 * @startingPoint section="Console" subtitle="Device rows: link state, battery, RSSI" viewport="700x200"
 */
export interface DeviceStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: 'connected' | 'weak' | 'offline' | 'pairing';
  /** e.g. "Remote 04". Falls back to the state label. */
  name?: React.ReactNode;
  /** Device ID, mono. */
  id?: string;
  /** 0–100. At or below 20 turns amber and swaps the glyph. */
  battery?: number;
  /** Signal strength in dBm, shown as a negative number. */
  rssi?: number;
  /** Icon + name only, for dense rows and matside headers. */
  compact?: boolean;
}
export declare function DeviceStatus(props: DeviceStatusProps): JSX.Element;
