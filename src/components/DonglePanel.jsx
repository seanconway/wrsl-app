const HANDSHAKE_LABEL = {
  disconnected: 'Disconnected',
  handshaking: 'Connecting…',
  ready: 'Connected',
  refused: 'Incompatible dongle',
};

function RemoteStatus({ label, status, colorClass }) {
  const connected = status.state === 'CONNECTED';
  return (
    <div className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
      <span className={`font-semibold ${colorClass}`}>{label}</span>
      <span className="text-sm text-gray-300">{status.state}</span>
      {connected && (
        <span className="text-sm text-gray-400">
          {status.rssi != null ? `${status.rssi} dBm` : '—'} · {status.batt != null ? `${status.batt}%` : '—'}
        </span>
      )}
    </div>
  );
}

function DonglePanel({ dongle }) {
  const {
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
  } = dongle;

  const isConnected = handshakeState !== 'disconnected';

  if (!isSupported) {
    return (
      <div className="mt-8 w-full max-w-md text-center text-sm text-gray-400">
        Web Serial is not available in this browser — the dongle cannot be connected here.
      </div>
    );
  }

  return (
    <div className="mt-8 w-full max-w-md">
      <div className="flex items-center justify-between bg-gray-800 rounded px-4 py-3 mb-3">
        <div>
          <div className="font-semibold">{HANDSHAKE_LABEL[handshakeState] ?? handshakeState}</div>
          {isStale && isConnected && (
            <div className="text-yellow-400 text-sm">No data from dongle — link stale</div>
          )}
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
        <div className="space-x-2">
          {!isConnected && hasAuthorizedPort && (
            <button onClick={reconnect} className="bg-blue-600 px-4 py-2 rounded text-sm">
              Reconnect
            </button>
          )}
          {!isConnected && (
            <button onClick={() => connect()} className="bg-blue-700 px-4 py-2 rounded text-sm">
              Connect Dongle
            </button>
          )}
          {isConnected && (
            <button onClick={disconnect} className="bg-gray-600 px-4 py-2 rounded text-sm">
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <RemoteStatus label="Red remote" status={linkStatus.RED} colorClass="text-red-400" />
        <RemoteStatus label="Green remote" status={linkStatus.GREEN} colorClass="text-green-400" />
      </div>

      <div className="text-center">
        <button
          onClick={() => setDebugEnabled((v) => !v)}
          className="text-xs text-gray-400 underline"
        >
          {debugEnabled ? 'Hide' : 'Show'} debug log
        </button>
      </div>

      {debugEnabled && (
        <div className="mt-2 bg-black rounded p-2 h-48 overflow-y-auto font-mono text-xs">
          {debugLog.length === 0 && logMessages.length === 0 && (
            <div className="text-gray-600">No traffic yet.</div>
          )}
          {debugLog.map((entry, i) => (
            <div key={i} className={entry.dir === 'TX' ? 'text-blue-400' : 'text-green-400'}>
              {new Date(entry.ts).toLocaleTimeString()} {entry.dir} {entry.line}
            </div>
          ))}
          {logMessages.map((entry, i) => (
            <div key={`log-${i}`} className="text-yellow-500">
              {new Date(entry.ts).toLocaleTimeString()} {entry.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DonglePanel;
