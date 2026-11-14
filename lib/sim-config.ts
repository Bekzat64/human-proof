// Simulation limits shared by server and client. No secrets here.

/** The simulation is timed, but never blocks: overtime is recorded, not refused. */
export const SIM_DURATION_MS = 15 * 60 * 1000;

/** Copilot messages a candidate may send in one attempt. */
export const MAX_USER_MESSAGES = 30;

export const MAX_MESSAGE_CHARS = 2000;

/** Events accepted in one POST /api/events. */
export const MAX_EVENTS_PER_BATCH = 50;

export const FLAG_NOTE_MIN_CHARS = 5;
export const FLAG_NOTE_MAX_CHARS = 500;
