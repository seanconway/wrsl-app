import { useState, useEffect } from "react";

function App() {
  const [redScore, setRedScore] = useState(0);
  const [greenScore, setGreenScore] = useState(0);
  const [periodTimes, setPeriodTimes] = useState([120, 120, 120]);
  const [currentPeriod, setCurrentPeriod] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let timer;

    if (isRunning && periodTimes[currentPeriod] > 0) {
      timer = setInterval(() => {
        setPeriodTimes((prev) => {
          const next = [...prev];
          next[currentPeriod] = Math.max(0, next[currentPeriod] - 1);
          return next;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isRunning, currentPeriod, periodTimes]);

  useEffect(() => {
    if (periodTimes[currentPeriod] === 0 && isRunning) {
      setIsRunning(false);
    }
  }, [periodTimes, currentPeriod, isRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrevPeriod = () => {
    setIsRunning(false);
    setCurrentPeriod((prev) => (prev - 1 + periodTimes.length) % periodTimes.length);
  };

  const handleNextPeriod = () => {
    setIsRunning(false);
    setCurrentPeriod((prev) => (prev + 1) % periodTimes.length);
  };

  const handleReset = () => {
    setIsRunning(false);
    setPeriodTimes((prev) => {
      const next = [...prev];
      next[currentPeriod] = 120;
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">Wrestling Scoreboard</h1>

      <div className="flex space-x-8 mb-8">
        <div className="text-center">
          <h2 className="text-2xl">Red</h2>
          <div className="text-6xl font-bold my-2">{redScore}</div>
          <div className="space-x-2">
            <button onClick={() => setRedScore(redScore + 1)} className="bg-red-600 px-4 py-2 rounded">+1</button>
            <button onClick={() => setRedScore(Math.max(0, redScore - 1))} className="bg-red-800 px-4 py-2 rounded">-1</button>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl">Green</h2>
          <div className="text-6xl font-bold my-2">{greenScore}</div>
          <div className="space-x-2">
            <button onClick={() => setGreenScore(greenScore + 1)} className="bg-green-600 px-4 py-2 rounded">+1</button>
            <button onClick={() => setGreenScore(Math.max(0, greenScore - 1))} className="bg-green-800 px-4 py-2 rounded">-1</button>
          </div>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-lg mb-2">Period {currentPeriod + 1}/{periodTimes.length}</div>
        <div className="text-5xl font-mono mb-4">{formatTime(periodTimes[currentPeriod])}</div>
        <div className="space-x-2 mb-3">
          <button onClick={handlePrevPeriod} className="bg-gray-700 px-5 py-2 rounded">Prev Period</button>
          <button onClick={handleNextPeriod} className="bg-gray-700 px-5 py-2 rounded">Next Period</button>
        </div>
        <div className="space-x-2">
          <button onClick={() => setIsRunning((prev) => !prev)} className="bg-blue-600 px-6 py-2 rounded">
            {isRunning ? "Pause" : "Start"}
          </button>
          <button onClick={handleReset} className="bg-yellow-600 px-6 py-2 rounded">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
