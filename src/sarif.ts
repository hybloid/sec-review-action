import * as core from '@actions/core';
import * as fs from 'fs';
import { context, getOctokit } from '@actions/github';
import { gzipSync } from 'zlib';

// Minimal SARIF types used (shared with index.ts)
export interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: { startLine?: number; startColumn?: number };
  };
}
export interface SarifResult {
  ruleId?: string;
  level?: 'none' | 'note' | 'warning' | 'error';
  kind?: string;
  message?: { text?: string; markdown?: string };
  locations?: SarifLocation[];
}
export interface SarifRun {
  tool?: { driver?: { name?: string } };
  results?: SarifResult[];
}
export interface SarifLog {
  version: string;
  runs?: SarifRun[];
}

export interface PrComment {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

/**
 * Build PR review comments from a SARIF log object.
 * Keeps logic purely functional to enable unit testing.
 */
export function buildPrCommentsFromSarif(sarif: SarifLog, maxComments: number = 50): PrComment[] {
  const runs = sarif?.runs ?? [];
  const comments: PrComment[] = [];

  for (const run of runs) {
    const results = run?.results ?? [];
    for (const res of results) {
      const loc = (res.locations && res.locations[0]) || {};
      const phys = loc.physicalLocation || {};
      const uri = phys.artifactLocation?.uri;
      const startLine = phys.region?.startLine;
      if (!uri || !startLine) continue;
      const message = res.message?.markdown || res.message?.text || res.ruleId || 'Issue';
      const level = res.level || 'warning';
      const body = `Security finding (${level})${res.ruleId ? ` [${res.ruleId}]` : ''}:\n\n${message}`;
      comments.push({ path: uri, line: startLine, side: 'RIGHT', body });
      if (comments.length >= maxComments) break;
    }
    if (comments.length >= maxComments) break;
  }

  return comments;
}

/**
 * Safely parse a SARIF JSON string. Returns undefined if parsing fails.
 */
export function parseSarif(json: string): SarifLog | undefined {
  try {
    return JSON.parse(json) as SarifLog;
  } catch (e: any) {
    core?.warning?.(`Failed to parse SARIF JSON: ${e?.message || e}`);
    return undefined;
  }
}


export async function uploadSarifToCodeScanning(sarifPath: string, githubToken: string) {
  if (!fs.existsSync(sarifPath)) {
    core.warning(`SARIF file not found for upload: ${sarifPath}`);
    return;
  }

  const { owner, repo } = context.repo;
  const commit_sha = context.sha;
  const ref = context.ref; // e.g., refs/heads/branch or PR ref

  try {
    const sarifRaw = fs.readFileSync(sarifPath);
    const gz = gzipSync(sarifRaw);
    const sarif_b64 = gz.toString('base64');

    const octokit = getOctokit(githubToken);

    core.info('Uploading SARIF to GitHub Code Scanning via Octokit...');
    const res = await octokit.rest.codeScanning.uploadSarif({
      owner,
      repo,
      commit_sha,
      ref,
      sarif: sarif_b64,
    });

    core.info(`SARIF upload accepted. status: ${res.status}${res.data?.id ? ", id: " + res.data.id : ''}`);
  } catch (e: any) {
    core.warning(`Failed to upload SARIF to Code Scanning: ${e?.message || e}`);
  }
}
