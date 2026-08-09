import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebSerialTransport } from '../transport/WebSerialTransport.js';
import { DongleService } from './DongleService.js';
import { selectIndicators, isInertInput } from '../match/matchReducer.js';

const LOG_UI_LIMIT = 200;

const DISCONNECTED_LINK_STATUS = {
  RED: { state: 'DISCONNECTED', rssi: null, batt: null },
  GREEN: { state: 'DISCONNECTED', rssi: null, batt: null },
};

/**
 * The only place React meets the dongle layer. Owns a WebSerialTransport +
 * DongleService pair and wires the match reducer's `dispatch` straight through,
 * so a referee press and an operator click take the identical path.
 *
 * State flows one way: the reducer holds match state, the service reads it
 * through a getter, and indicator assertion is driven off changes to it. The
 * service never holds a second copy.
 */
export function useDongleConnection(matchState, dispatch) {
  const serviceRef = useRef(null);
  const matchStateRef = useRef(matchState);
  matchStateRef.current = matchState;

  const [handshakeState, setHandshakeState] = useState('disconnected');
  const [isStale, setIsStale] = useState(false);
  const [linkStatus, setLinkStatus] = useState(DISCONNECTED_LINK_STATUS);
  const [identity, setIdentity] = useState(null);
  const [counters, setCounters] = useState({});
  const [debugLog, setDebugLog] = useState([]);
  const [logMessages, setLogMessages] = useState([]);
  const [error, setError] = useState(null);
  const [hasAuthorizedPort, setHasAuthorizedPort] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  const isSupported = useMemo(() => WebSerialTransport.isSupported(), []);

  useEffect(() => {
    if (!isSupported) return;
    WebSerialTransport.getAuthorizedPorts().then((ports) => setHasAuthorizedPort(ports.length > 0));
  }, [isSupported]);

  const ensureService = useCallback(() => {
    if (serviceRef.current) return serviceRef.current;

    const transport = new WebSerialTransport();
    const service = new DongleService(transport, {
      dispatch,
      getMatchState: () => matchStateRef.current,
      selectIndicators: () => selectIndicators(matchStateRef.current),
      isInertInput,
      onLog: (msg) => setLogMessages((prev) => [...prev, { ts: Date.now(), msg }].slice(-LOG_UI_LIMIT)),
      onLinkChange: (remote, status) => setLinkStatus((prev) => ({ ...prev, [remote]: status })),
      onStaleChange: setIsStale,
      onHandshakeStateChange: setHandshakeState,
      onIdentityChange: setIdentity,
      onCountersChange: (next) => setCounters(next),
      onDebugLine: (entry) => setDebugLog((prev) => [...prev, entry].slice(-LOG_UI_LIMIT)),
    });

    serviceRef.current = service;
    return service;
  }, [dispatch]);

  // Indicator assertion. Driven off the match state the reducer holds, and
  // deduplicated inside the service, so this can safely run on every change.
  useEffect(() => {
    serviceRef.current?.assertIndicators();
  }, [matchState]);

  // Notification outbox. The reducer produces notifications as data; this drains
  // them onto the wire and clears exactly what it sent, by id.
  useEffect(() => {
    const outbox = matchState.outbox;
    if (!outbox?.length) return;
    const sent = serviceRef.current?.sendNotifications(outbox) ?? [];
    if (sent.length > 0) dispatch({ type: 'OUTBOX_SENT', ids: sent });
  }, [matchState.outbox, dispatch]);

  useEffect(() => () => serviceRef.current?.destroy(), []);

  const connect = useCallback(
    async ({ port } = {}) => {
      setError(null);
      const service = ensureService();
      try {
        await service.connect(port ? { port } : undefined);
      } catch (err) {
        setError(describeConnectionError(err));
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
    await serviceRef.current?.disconnect();
  }, []);

  /** The watchdog's hand on the plug (FS §8.3). Dropping the transport rather
   *  than the service, so the dongle sees silence and its supervision fires. */
  const dropForFault = useCallback(async () => {
    try {
      await serviceRef.current?.disconnect();
    } catch {
      // The point is that the link goes away; how it goes away does not matter.
    }
  }, []);

  const sendRaw = useCallback((line) => serviceRef.current?.sendRaw(line) ?? false, []);
  const setConfig = useCallback((config) => serviceRef.current?.setConfig(config), []);

  return {
    isSupported,
    handshakeState,
    isStale,
    linkStatus,
    identity,
    counters,
    debugLog,
    logMessages,
    error,
    hasAuthorizedPort,
    debugEnabled,
    setDebugEnabled,
    connect,
    reconnect,
    disconnect,
    dropForFault,
    sendRaw,
    setConfig,
  };
}

/**
 * A policy block and a cancelled picker are the same DOMException family and
 * present identically as raw text. They need completely different responses
 * from the operator, so they get completely different sentences.
 */
export function describeConnectionError(err) {
  const name = err?.name ?? '';
  const message = err?.message ?? String(err);

  if (name === 'NotFoundError') {
    return 'No dongle selected. Pick the RefRemote dongle from the list and try again.';
  }
  if (name === 'SecurityError') {
    return 'This machine blocks serial access for this site. An administrator must allow it before the dongle can be used.';
  }
  if (name === 'NetworkError' || /failed to open/i.test(message)) {
    return 'The dongle could not be opened. Another application may be holding the port — close any serial terminal and try again.';
  }
  if (/not available/i.test(message)) {
    return 'This browser cannot reach serial devices. Use a Chromium-based browser.';
  }
  return message;
}
