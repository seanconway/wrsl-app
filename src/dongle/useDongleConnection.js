import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebSerialTransport } from '../transport/WebSerialTransport.js';
import { DongleService } from './DongleService.js';

const LOG_UI_LIMIT = 200;

const DISCONNECTED_LINK_STATUS = {
  RED: { state: 'DISCONNECTED', rssi: null, batt: null },
  GREEN: { state: 'DISCONNECTED', rssi: null, batt: null },
};

/**
 * The only place React meets the dongle layer: owns a WebSerialTransport +
 * DongleService pair and wires `dispatch` from the scoreboard reducer
 * straight through, so EVT lines drive the same state transitions the UI
 * buttons do.
 */
export function useDongleConnection(scoreboardState, dispatch) {
  const serviceRef = useRef(null);

  const [handshakeState, setHandshakeState] = useState('disconnected');
  const [isStale, setIsStale] = useState(false);
  const [linkStatus, setLinkStatus] = useState(DISCONNECTED_LINK_STATUS);
  const [debugLog, setDebugLog] = useState([]);
  const [logMessages, setLogMessages] = useState([]);
  const [error, setError] = useState(null);
  const [hasAuthorizedPort, setHasAuthorizedPort] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  const isSupported = useMemo(() => WebSerialTransport.isSupported(), []);

  useEffect(() => {
    if (!isSupported) return;
    WebSerialTransport.getAuthorizedPorts().then((ports) => {
      setHasAuthorizedPort(ports.length > 0);
    });
  }, [isSupported]);

  const ensureService = useCallback(() => {
    if (serviceRef.current) return serviceRef.current;

    const transport = new WebSerialTransport();
    const service = new DongleService(transport, {
      dispatch,
      onLog: (msg) =>
        setLogMessages((prev) => [...prev, { ts: Date.now(), msg }].slice(-LOG_UI_LIMIT)),
      onLinkChange: (remote, status) =>
        setLinkStatus((prev) => ({ ...prev, [remote]: status })),
      onStaleChange: setIsStale,
      onHandshakeStateChange: setHandshakeState,
      onDebugLine: (entry) => setDebugLog((prev) => [...prev, entry].slice(-LOG_UI_LIMIT)),
    });

    serviceRef.current = service;
    return service;
  }, [dispatch]);

  // Re-run from scratch on every reconnect (§8) — no state resumption.
  useEffect(() => {
    serviceRef.current?.syncScoreboardState(scoreboardState);
  }, [scoreboardState]);

  useEffect(
    () => () => {
      serviceRef.current?.destroy();
    },
    [],
  );

  const connect = useCallback(
    async ({ port } = {}) => {
      setError(null);
      const service = ensureService();
      try {
        await service.connect(port ? { port } : undefined);
      } catch (err) {
        setError(err.message ?? String(err));
        throw err;
      }
    },
    [ensureService],
  );

  const reconnect = useCallback(async () => {
    const ports = await WebSerialTransport.getAuthorizedPorts();
    return connect(ports.length > 0 ? { port: ports[0] } : {});
  }, [connect]);

  const disconnect = useCallback(async () => {
    if (!serviceRef.current) return;
    await serviceRef.current.disconnect();
  }, []);

  return {
    isSupported,
    handshakeState,
    isStale,
    linkStatus,
    debugLog,
    logMessages,
    error,
    hasAuthorizedPort,
    debugEnabled,
    setDebugEnabled,
    connect,
    reconnect,
    disconnect,
  };
}
