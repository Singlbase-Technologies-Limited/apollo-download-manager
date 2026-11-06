import { describe, expect, it } from 'vitest';
import { ago, failureLabel, statusView } from '../src/shared/popup-view';

const ok = (result: Record<string, unknown>) => ({ v: 1, id: 'x', ok: true as const, result });
const err = (code: string, message: string) => ({ v: 1, id: 'x', ok: false as const, error: { code, message } });

describe('popup connection badge (#356)', () => {
  it('shows the app version when everything is up', () => {
    expect(statusView(ok({ version: '0.2.0', engineRunning: true, acceptsRequests: true }))).toEqual({ text: 'Connected · app 0.2.0', tone: 'ok', offline: null });
  });

  it('warns when the engine is down or browser requests are off', () => {
    expect(statusView(ok({ version: '0.2.0', engineRunning: false, acceptsRequests: true }))).toMatchObject({ text: "Connected, but the download engine isn't running", tone: 'warn' });
    expect(statusView(ok({ version: '0.2.0', engineRunning: true, acceptsRequests: false }))).toMatchObject({ text: 'Connected, but browser requests are off in the app', tone: 'warn' });
  });

  it('explains a failure in the offline card, with the reason it got', () => {
    expect(statusView(err('DESKTOP_NOT_RUNNING', 'Apollo Download Manager is not running.'))).toEqual({ text: 'Not connected', tone: 'err', offline: 'Apollo Download Manager is not running.' });
  });

  it('never shows a version that is not a plain version string', () => {
    expect(statusView(ok({ version: '<img src=x>', engineRunning: true, acceptsRequests: true })).text).toBe('Connected');
  });
});

describe('recent send labels', () => {
  it('names the common failures in plain words', () => {
    expect(failureLabel('DESKTOP_NOT_RUNNING')).toBe('App not running');
    expect(failureLabel('DISABLED')).toBe('Browser requests off');
    expect(failureLabel(undefined)).toBe('Failed');
    expect(failureLabel('SOMETHING_ELSE')).toBe('Failed');
  });

  it('says how long ago', () => {
    const now = 10 * 86_400_000;
    expect(ago(now - 20_000, now)).toBe('just now');
    expect(ago(now - 2 * 60_000, now)).toBe('2 min ago');
    expect(ago(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(ago(now - 30 * 3_600_000, now)).toBe('yesterday');
    expect(ago(now - 4 * 86_400_000, now)).toBe('4 days ago');
  });
});
