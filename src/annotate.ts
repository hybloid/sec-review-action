import * as core from '@actions/core';
import * as fs from 'fs';
import { context, getOctokit } from '@actions/github';
import { buildPrCommentsFromSarif, parseSarif } from './sarif';

export async function annotatePullRequestFromSarif(sarifPath: string, githubToken: string) {
  const pr = context.payload.pull_request;
  if (!pr) {
    core.info('Not a pull_request event; skipping PR annotations.');
    return;
  }
  const octokit = getOctokit(githubToken);
  const { owner, repo } = context.repo;
  const pull_number = pr.number;

  if (!fs.existsSync(sarifPath)) {
    core.warning(`SARIF file not found for PR annotations: ${sarifPath}`);
    return;
  }

  const sarifRaw = fs.readFileSync(sarifPath, 'utf8');
  const sarif = parseSarif(sarifRaw);
  if (!sarif) return;

  const comments = buildPrCommentsFromSarif(sarif, 50);

  if (comments.length === 0) {
    core.info('No SARIF results to annotate on the PR.');
    return;
  }

  core.info(`Creating PR review with ${comments.length} comment(s) from SARIF findings...`);
  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      event: 'COMMENT',
      comments,
    });
    core.info('PR review created successfully with SARIF annotations.');
  } catch (e: any) {
    core.warning(`Failed to create PR review comments: ${e?.message || e}`);
  }
}
