import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { context, getOctokit } from '@actions/github';
import { buildPrCommentsFromSarif, parseSarif, uploadSarifToCodeScanning } from './sarif';

async function annotatePullRequestFromSarif(sarifPath: string, githubToken: string) {
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


async function run() {
  try {
    // Inputs
    const model = core.getInput('model');
    const repoPath = core.getInput('repo-path') || '.';
    const resultPath = core.getInput('result-path') || '.';
    const temperature = core.getInput('temperature') || '0.0';
    const prompt = core.getInput('prompt');
    const jbaiToken = core.getInput('jbai-token');
    const jbaiEnvironment = core.getInput('jbai-environment') || 'staging';
    const githubToken = core.getInput('github-token');

    if (!jbaiToken) {
      core.setFailed('jbai-token is required');
      return;
    }

    // Set environment variable
    process.env.JBAI_TOKEN = jbaiToken;
    process.env.JBAI_ENVIRONMENT = jbaiEnvironment;

    // Build command arguments
    const args = [
      '-jar',
      'tool/analysis.jar',
      `--repo=${repoPath}`,
      `--result=${resultPath}`,
      `--temperature=${temperature}`,
      `--shouldProduceSarif=true`,
    ];

    if (model) args.push(`--model=${model}`);
    if (prompt) args.push(`--prompt=${prompt}`);

    core.info('Running static security analysis...');
    core.info(`Command: java ${args.join(' ')}`);

    // Execute the JAR file
    await exec.exec('java', args);

    // Check if SARIF file was created
    const sarifPath = path.join(resultPath, 'security-review.sarif');
    if (fs.existsSync(sarifPath)) {
      core.info('SARIF file created successfully');
      core.setOutput('sarif-file', sarifPath);
      core.info('SARIF file ready for upload');
      core.info(`SARIF file location: ${sarifPath}`);

      // Annotate PR if possible and upload SARIF to code scanning if token provided
      if (githubToken) {
        await annotatePullRequestFromSarif(sarifPath, githubToken);
        await uploadSarifToCodeScanning(sarifPath, githubToken);
      } else {
        core.info('github-token not provided; skipping PR annotations and SARIF upload.');
      }
    } else {
      core.warning('SARIF file not found at expected location');
      core.setFailed('Expected SARIF file was not generated');
    }
  } catch (error: any) {
    core.setFailed(`Action failed with error: ${error?.message || error}`);
  }
}

run();
