// Pure scoreboard state transitions, shared by the UI and the dongle
// service so both drive the exact same logic.

export const DEFAULT_PERIOD_SECONDS = 120;
export const PERIOD_COUNT = 3;

export function createInitialScoreboardState() {
  return {
    redScore: 0,
    greenScore: 0,
    periodTimes: Array(PERIOD_COUNT).fill(DEFAULT_PERIOD_SECONDS),
    currentPeriod: 0,
    isRunning: false,
  };
}

function scoreKey(color) {
  return color === 'RED' ? 'redScore' : 'greenScore';
}

function adjustCurrentPeriodTime(state, delta) {
  const next = [...state.periodTimes];
  next[state.currentPeriod] = Math.max(0, next[state.currentPeriod] + delta);
  return { ...state, periodTimes: next };
}

export function scoreboardReducer(state, action) {
  switch (action.type) {
    case 'ADD_POINT':
      return { ...state, [scoreKey(action.color)]: state[scoreKey(action.color)] + 1 };

    case 'REMOVE_POINT':
      return {
        ...state,
        [scoreKey(action.color)]: Math.max(0, state[scoreKey(action.color)] - 1),
      };

    case 'TOGGLE_TIMER':
      return { ...state, isRunning: !state.isRunning };

    case 'TIME_UP':
      return adjustCurrentPeriodTime(state, 1);

    case 'TIME_DOWN':
      return adjustCurrentPeriodTime(state, -1);

    case 'PERIOD_UP':
      return {
        ...state,
        isRunning: false,
        currentPeriod: (state.currentPeriod + 1) % state.periodTimes.length,
      };

    case 'PERIOD_DOWN':
      return {
        ...state,
        isRunning: false,
        currentPeriod: (state.currentPeriod - 1 + state.periodTimes.length) % state.periodTimes.length,
      };

    case 'RESET_PERIOD_TIME': {
      const next = [...state.periodTimes];
      next[state.currentPeriod] = DEFAULT_PERIOD_SECONDS;
      return { ...state, isRunning: false, periodTimes: next };
    }

    case 'TICK': {
      if (!state.isRunning) return state;
      const next = [...state.periodTimes];
      const remaining = Math.max(0, next[state.currentPeriod] - action.deltaSeconds);
      next[state.currentPeriod] = remaining;
      return { ...state, periodTimes: next, isRunning: remaining > 0 };
    }

    default:
      return state;
  }
}
