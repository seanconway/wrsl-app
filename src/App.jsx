import { useReducer } from "react";
import { scoreboardReducer, createInitialScoreboardState } from "./scoreboard/scoreboardReducer";
import { useScoreboardClock } from "./scoreboard/useScoreboardClock";
import { useDongleConnection } from "./dongle/useDongleConnection";
import DonglePanel from "./components/DonglePanel";

function App() {
  const [state, dispatch] = useReducer(scoreboardReducer, undefined, createInitialScoreboardState);
  const { redScore, greenScore, periodTimes, currentPeriod, isRunning } = state;

  useScoreboardClock(isRunning, dispatch);
  const dongle = useDongleConnection(state, dispatch);

  const formatTime = (seconds) => {
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">Wrestling Scoreboard</h1>

      <div className="flex space-x-8 mb-8">
        <div className="text-center">
          <h2 className="text-2xl">Red</h2>
          <div className="text-6xl font-bold my-2">{redScore}</div>
          <div className="space-x-2">
            <button onClick={() => dispatch({ type: 'ADD_POINT', color: 'RED' })} className="bg-red-600 px-4 py-2 rounded">+1</button>
            <button onClick={() => dispatch({ type: 'REMOVE_POINT', color: 'RED' })} className="bg-red-800 px-4 py-2 rounded">-1</button>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl">Green</h2>
          <div className="text-6xl font-bold my-2">{greenScore}</div>
          <div className="space-x-2">
            <button onClick={() => dispatch({ type: 'ADD_POINT', color: 'GREEN' })} className="bg-green-600 px-4 py-2 rounded">+1</button>
            <button onClick={() => dispatch({ type: 'REMOVE_POINT', color: 'GREEN' })} className="bg-green-800 px-4 py-2 rounded">-1</button>
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-lg mb-2">Period {currentPeriod + 1}/{periodTimes.length}</div>
        <div className="text-5xl font-mono mb-4">{formatTime(periodTimes[currentPeriod])}</div>
        <div className="space-x-2 mb-3">
          <button onClick={() => dispatch({ type: 'PERIOD_DOWN' })} className="bg-gray-700 px-5 py-2 rounded">Prev Period</button>
          <button onClick={() => dispatch({ type: 'PERIOD_UP' })} className="bg-gray-700 px-5 py-2 rounded">Next Period</button>
        </div>
        <div className="space-x-2 mb-3">
          <button onClick={() => dispatch({ type: 'TIME_UP' })} className="bg-indigo-600 px-5 py-2 rounded">Increment Time</button>
          <button onClick={() => dispatch({ type: 'TIME_DOWN' })} className="bg-indigo-700 px-5 py-2 rounded">Decrement Time</button>
        </div>
        <div className="space-x-2">
          <button onClick={() => dispatch({ type: 'TOGGLE_TIMER' })} className="bg-blue-600 px-6 py-2 rounded">
            {isRunning ? "Pause" : "Start"}
          </button>
          <button onClick={() => dispatch({ type: 'RESET_PERIOD_TIME' })} className="bg-yellow-600 px-6 py-2 rounded">
            Reset
          </button>
        </div>
      </div>

      <DonglePanel dongle={dongle} />
    </div>
  );
}

export default App;
