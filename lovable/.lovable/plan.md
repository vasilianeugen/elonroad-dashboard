## Problem

In `SessionDetailsTable`, sessions sharing the same date appear in arbitrary order because the sort only compares `date`. Within a date, two sessions for the same vehicle/charger can show up out of chronological order (e.g. 13 May TT-109 / Charger-5 with 17:36 above 17:29).

## Fix

Add a chronological tiebreaker to the sort in `src/components/SessionDetailsTable.tsx` (lines 89–109):

- After comparing the chosen `sortField`, if the result is `0`, fall back to:
  1. `date` ascending (UTC date string compare)
  2. `startTime` ascending (UTC `HH:MM:SS` string compare — lexicographic works since zero-padded)
- Tiebreakers are always ascending regardless of the active sort direction, so the natural reading order inside each group is earliest → latest.
- For the `date` sort field itself, keep the chosen direction for the date, but always use ascending `startTime` as the secondary key (so within a single day rows stay chronological top-to-bottom).

No changes to data, time-zone conversion, or UI structure — only the comparator.

## Verification

- Reload the Session Details table, navigate to 13 May 2026, confirm the two TT-109 / Charger-5 Power Rail rows appear with 17:29:52 above 17:36:21.
- Spot-check a couple more dates with multiple sessions per vehicle to confirm chronological order both in desktop table and mobile cards.