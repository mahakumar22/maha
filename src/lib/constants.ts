/**
 * How many days the habit board shows at once, today included. The server
 * accepts writes across the same window, so this is the single place that
 * decides how far back a forgotten day can be filled in.
 */
export const VISIBLE_DAYS = 7;
