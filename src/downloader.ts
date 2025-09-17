import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

async function fetchJson(url: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'sec-review-action'
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return await res.json();
}

async function downloadWithProgress(url: string, destPath: string): Promise<void> {
  const headers: Record<string, string> = {
    'Accept': 'application/octet-stream',
    'User-Agent': 'sec-review-action'
  };

  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download asset: HTTP ${res.status}`);
  }

  const total = Number(res.headers.get('content-length') || '0');
  let downloaded = 0;
  const reader = (res.body as ReadableStream).getReader();
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const file = fs.createWriteStream(destPath);

  let lastLogged = Date.now();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const buf = Buffer.from(value as Uint8Array);
        file.write(buf);
        downloaded += buf.length;
        const now = Date.now();
        if (now - lastLogged > 1000) {
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            core.info(`Downloading analysis.jar: ${pct}% (${downloaded}/${total} bytes)`);
          } else {
            core.info(`Downloading analysis.jar: ${downloaded} bytes`);
          }
          lastLogged = now;
        }
      }
    }
  } finally {
    file.end();
  }
  core.info(`Download complete: ${downloaded} bytes`);

  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
    throw new Error('Downloaded analysis.jar is empty or missing');
  }
}

export async function resolveJarFromOwnRelease(): Promise<string> {
  const actionRepo = process.env.GITHUB_ACTION_REPOSITORY || 'hybloid/sec-review-action';
  core.info(`Resolving analysis.jar from latest release of ${actionRepo}...`);

  // Use the public latest release endpoint (excludes drafts). If that fails, try list releases.
  let release: any;
  try {
    release = await fetchJson(`https://api.github.com/repos/${actionRepo}/releases/latest`);
  } catch (e) {
    core.warning(`Failed to fetch latest release (stable): ${e}`);
    const releases = await fetchJson(`https://api.github.com/repos/${actionRepo}/releases?per_page=1`);
    if (Array.isArray(releases) && releases.length > 0) release = releases[0];
  }
  if (!release) {
    throw new Error(`No releases found for ${actionRepo}`);
  }

  const assets: any[] = release.assets || [];
  const jarAsset = assets.find(a => a.name === 'analysis.jar') || assets.find(a => /\.jar$/i.test(a.name));
  if (!jarAsset) {
    throw new Error('No JAR asset in the latest release');
  }

  const url = jarAsset.browser_download_url || (jarAsset.url /* fallback to API URL */);
  if (!url) throw new Error('Asset download URL not found');

  const tmpDir = process.env['RUNNER_TEMP'] || path.join(process.cwd(), '.tmp');
  const dest = path.join(tmpDir, 'analysis.jar');
  await downloadWithProgress(url, dest);
  return dest;
}
