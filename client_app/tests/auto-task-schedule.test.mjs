'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue, markTriggered, normalizeTargets } from '../src/modules/auto-task-kill.js';

const base = new Date('2026-08-25T10:30:00'); // Tuesday, 10:30 local

test('Once schedule is due when runAt passed and still enabled', () => {
  const schedule = {
    enabled: true,
    kind: 'Once',
    runAt: new Date(base.getTime() - 60_000).toISOString(),
    processNames: ['notepad'],
  };
  assert.equal(isDue(schedule, base), true);
});

test('Once schedule is not due before runAt', () => {
  const schedule = {
    enabled: true,
    kind: 'Once',
    runAt: new Date(base.getTime() + 60_000).toISOString(),
  };
  assert.equal(isDue(schedule, base), false);
});

test('Once schedule disabled after trigger', () => {
  const schedules = [{
    scheduleId: 'S1',
    enabled: true,
    kind: 'Once',
    runAt: new Date(base.getTime() - 1000).toISOString(),
  }];
  markTriggered(schedules, 'S1', base);
  assert.equal(schedules[0].enabled, false);
  assert.ok(schedules[0].completedAt);
});

test('Daily schedule due only in the exact minute', () => {
  const schedule = { enabled: true, kind: 'Daily', dailyTime: '10:30' };
  assert.equal(isDue(schedule, base), true);
  assert.equal(isDue(schedule, new Date('2026-08-25T10:31:00')), false);
  assert.equal(isDue(schedule, new Date('2026-08-25T09:30:00')), false);
});

test('Daily schedule fires once per day (lastTriggeredDate guard)', () => {
  const schedules = [{ scheduleId: 'D1', enabled: true, kind: 'Daily', dailyTime: '10:30' }];
  markTriggered(schedules, 'D1', base);
  assert.equal(isDue(schedules[0], new Date('2026-08-25T10:30:30')), false); // same day
  assert.equal(isDue(schedules[0], new Date('2026-08-26T10:30:00')), true); // next day
});

test('Daily schedule respects daysOfWeek filter', () => {
  const mondayOnly = { enabled: true, kind: 'Daily', dailyTime: '10:30', daysOfWeek: ['Monday'] };
  // 2026-08-25 is a Tuesday
  assert.equal(isDue(mondayOnly, base), false);
  assert.equal(isDue(mondayOnly, new Date('2026-08-24T10:30:00')), true);
});

test('disabled schedule never due; invalid dailyTime never due', () => {
  assert.equal(isDue({ enabled: false, kind: 'Daily', dailyTime: '10:30' }, base), false);
  assert.equal(isDue({ enabled: true, kind: 'Daily', dailyTime: 'bad' }, base), false);
});

test('normalizeTargets strips .exe and dedupes case-insensitively', () => {
  assert.deepEqual(
    normalizeTargets(['Notepad.EXE', 'notepad', ' CHROME ', '']),
    ['Notepad', 'CHROME'],
  );
});
