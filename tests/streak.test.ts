import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDays,
  daysBetween,
  isEditableDate,
  isISODate,
  recentDays,
  toISODate,
} from "../src/lib/dates";
import { computeStreaks } from "../src/lib/streak";
import { VISIBLE_DAYS } from "../src/lib/constants";

describe("computeStreaks", () => {
  it("reports nothing for a habit with no history", () => {
    assert.deepEqual(computeStreaks([], "2026-09-08"), { current: 0, longest: 0, total: 0 });
  });

  it("counts a single completion today", () => {
    assert.deepEqual(computeStreaks(["2026-09-08"], "2026-09-08"), {
      current: 1,
      longest: 1,
      total: 1,
    });
  });

  it("counts consecutive days ending today", () => {
    assert.deepEqual(computeStreaks(["2026-09-06", "2026-09-07", "2026-09-08"], "2026-09-08"), {
      current: 3,
      longest: 3,
      total: 3,
    });
  });

  it("keeps the streak alive while today is still unfinished", () => {
    assert.equal(computeStreaks(["2026-09-06", "2026-09-07"], "2026-09-08").current, 2);
  });

  it("breaks the streak once a whole day has been missed", () => {
    const streaks = computeStreaks(["2026-09-05", "2026-09-06"], "2026-09-08");
    assert.equal(streaks.current, 0);
    assert.equal(streaks.longest, 2);
  });

  it("remembers the longest run across a gap", () => {
    assert.deepEqual(
      computeStreaks(
        ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-09-07", "2026-09-08"],
        "2026-09-08",
      ),
      { current: 2, longest: 4, total: 6 },
    );
  });

  it("does not let a duplicate date inflate a streak", () => {
    assert.deepEqual(computeStreaks(["2026-09-08", "2026-09-08", "2026-09-07"], "2026-09-08"), {
      current: 2,
      longest: 2,
      total: 2,
    });
  });

  it("does not depend on the input being sorted", () => {
    assert.equal(
      computeStreaks(["2026-09-08", "2026-09-06", "2026-09-07"], "2026-09-08").current,
      3,
    );
  });

  it("spans month, leap-day and year boundaries", () => {
    assert.equal(computeStreaks(["2026-08-30", "2026-08-31", "2026-09-01"], "2026-09-01").current, 3);
    assert.equal(computeStreaks(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01").current, 3);
    assert.equal(computeStreaks(["2026-12-31", "2027-01-01"], "2027-01-01").current, 2);
  });
});

describe("date helpers", () => {
  it("steps across daylight saving transitions without slipping a day", () => {
    assert.equal(addDays("2027-03-13", 1), "2027-03-14");
    assert.equal(addDays("2027-03-14", 1), "2027-03-15");
    assert.equal(addDays("2027-11-07", -1), "2027-11-06");
  });

  it("rolls over months, years and leap days", () => {
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  });

  it("measures signed distance between days", () => {
    assert.equal(daysBetween("2026-09-01", "2026-09-08"), 7);
    assert.equal(daysBetween("2026-09-08", "2026-09-01"), -7);
    assert.equal(daysBetween("2026-09-08", "2026-09-08"), 0);
  });

  it("lists the last seven days ending today", () => {
    const days = recentDays("2026-09-08", 7);
    assert.equal(days.length, 7);
    assert.equal(days[0], "2026-09-02");
    assert.equal(days[6], "2026-09-08");
  });

  it("rejects malformed and impossible dates", () => {
    assert.equal(isISODate("2026-09-08"), true);
    assert.equal(isISODate("2026-02-30"), false);
    assert.equal(isISODate("2026-13-01"), false);
    assert.equal(isISODate("2026-9-8"), false);
    assert.equal(isISODate("2026-09-08'; drop table habits;--"), false);
    assert.equal(isISODate(null), false);
    assert.equal(isISODate(20260908), false);
  });

  it("reads the local calendar date, not the UTC one", () => {
    assert.equal(toISODate(new Date(2026, 8, 8, 23, 30)), "2026-09-08");
    assert.equal(toISODate(new Date(2026, 0, 1, 0, 1)), "2026-01-01");
  });
});

describe("isEditableDate", () => {
  const utcToday = "2026-09-08";

  // The bug this guards against: the board rendered seven days, but the server
  // only accepted two, so the five older dots threw "Invalid date." Every day
  // the board draws must be writable, in any timezone.
  it("accepts every day the board actually shows", () => {
    for (const clientToday of [addDays(utcToday, -1), utcToday, addDays(utcToday, 1)]) {
      for (const day of recentDays(clientToday, VISIBLE_DAYS)) {
        assert.equal(
          isEditableDate(day, utcToday, VISIBLE_DAYS),
          true,
          `${day} is on the board (client today ${clientToday}) but was rejected`,
        );
      }
    }
  });

  it("allows a client one day ahead of the server", () => {
    assert.equal(isEditableDate(addDays(utcToday, 1), utcToday, VISIBLE_DAYS), true);
  });

  it("rejects days further ahead than any timezone allows", () => {
    assert.equal(isEditableDate(addDays(utcToday, 2), utcToday, VISIBLE_DAYS), false);
  });

  it("rejects backfilling older than the visible window", () => {
    assert.equal(isEditableDate(addDays(utcToday, -VISIBLE_DAYS), utcToday, VISIBLE_DAYS), true);
    assert.equal(
      isEditableDate(addDays(utcToday, -(VISIBLE_DAYS + 1)), utcToday, VISIBLE_DAYS),
      false,
    );
  });

  it("rejects anything that is not a real date", () => {
    assert.equal(isEditableDate("nope", utcToday, VISIBLE_DAYS), false);
    assert.equal(isEditableDate("2026-02-30", utcToday, VISIBLE_DAYS), false);
    assert.equal(isEditableDate(null, utcToday, VISIBLE_DAYS), false);
  });
});
