import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { uploadSarifToCodeScanning } from './sarif';
import { resolveJarFromOwnRelease } from './downloader';
import { annotatePullRequestFromSarif } from './annotate';
import { uploadSarifArtifact } from './artifacts';

async function run() {
  try {
    // Inputs
    const model = core.getInput('model');
    const repoPath = core.getInput('repo-path') || '.';
    const resultPath = core.getInput('result-path') || '.';
    const temperature = core.getInput('temperature') || '0.0';
    const prompt = core.getInput('prompt');
    const authType = core.getInput('authType');
    const branch = core.getInput('branch');
    const jbaiToken = core.getInput('jbai-token');
    const jbaiEnvironment = core.getInput('jbai-environment') || 'staging';
    const githubToken = core.getInput('github-token');

    if (!jbaiToken) {
      core.setFailed('jbai-token is required');
      return;
    }

    // Download analysis.jar from this action's latest release
    const jarPath = await resolveJarFromOwnRelease();

    // Build command arguments
    const args = [
      `-DJBAI_TOKEN=${jbaiToken}`,
      `-DJBAI_ENVIRONMENT=${jbaiEnvironment}`,
      '-jar',
      jarPath,
      `--repo=${repoPath}`,
      `--result=${resultPath}`,
      `--temperature=${temperature}`,
      `--shouldProduceSarif=true`,
    ];

    if (model) args.push(`--model=${model}`);
    if (prompt) args.push(`--prompt=${prompt}`);
    if (authType) args.push(`--authType=${authType}`);
    if (branch) args.push(`--branch=${branch}`);

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

      // Always upload SARIF as a workflow artifact if it exists
      await uploadSarifArtifact(sarifPath, 'security-review-sarif', 7)
    } else {
      core.warning('SARIF file not found at expected location');
      core.setFailed('Expected SARIF file was not generated');
    }
  } catch (error: any) {
    core.setFailed(`Action failed with error: ${error?.message || error}`);
  }
}

run();
