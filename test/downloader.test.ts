import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import { resolveJarFromOwnRelease } from '../src/downloader';

// Increase timeout to allow real network download
jest.setTimeout(120000);

describe('downloader.resolveJarFromOwnRelease (real GitHub release)', () => {
  const tmpRoot = path.join(__dirname, 'tmp');
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    // Ensure tmp directory
    fs.rmSync(tmpRoot, { force: true, recursive: true });
    fs.mkdirSync(tmpRoot, { recursive: true });
    process.env.RUNNER_TEMP = tmpRoot;

    // Spy on core.info to ensure progress is logged (at least completion)
    infoSpy = jest.spyOn(core, 'info').mockImplementation((..._args: any[]) => undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads jar from latest public release and reports progress', async () => {
    // Optionally allow overriding repository under test via env for CI stability
    // process.env.GITHUB_ACTION_REPOSITORY can be set by CI to point to a repo that has a JAR asset

    const dest = await resolveJarFromOwnRelease();

    expect(dest).toBe(path.join(tmpRoot, 'analysis.jar'));
    expect(fs.existsSync(dest)).toBe(true);
    const size = fs.statSync(dest).size;
    expect(size).toBeGreaterThan(0);

    // Ensure some logging happened (at least final log)
    expect(infoSpy).toHaveBeenCalled();
    const msgs = infoSpy.mock.calls.map(c => String(c[0]));
    expect(msgs.some(m => m.includes('Download complete'))).toBe(true);
  });
});
