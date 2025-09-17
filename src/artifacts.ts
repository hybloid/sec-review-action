import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import artifactClient from '@actions/artifact';

/**
 * Upload a SARIF file as a GitHub Actions artifact.
 * - artifact name defaults to 'security-review-sarif'
 * - retention defaults to 7 days
 */
export async function uploadSarifArtifact(
  sarifPath: string,
  artifactName: string = 'security-review-sarif',
  retentionDays: number = 7
): Promise<void> {
  try {
    if (!sarifPath) {
      core.warning('uploadSarifArtifact called without sarifPath');
      return;
    }
    if (!fs.existsSync(sarifPath)) {
      core.warning(`SARIF file does not exist, skipping artifact upload: ${sarifPath}`);
      return;
    }

    const files = [path.basename(sarifPath)];
    const rootDir = path.dirname(sarifPath);

    const uploadResponse = await artifactClient.uploadArtifact(
      artifactName,
      files,
      rootDir,
      { retentionDays }
    );

    const uploadedSize = uploadResponse.size ?? 0;
    const artifactId = uploadResponse.id;
    if (artifactId) {
      core.info(`Uploaded artifact '${artifactName}' (id=${artifactId}, size=${uploadedSize} bytes).`);
    } else if (uploadedSize > 0) {
      core.info(`Uploaded artifact '${artifactName}' (size=${uploadedSize} bytes).`);
    } else {
      core.warning(`Artifact '${artifactName}' upload completed but server did not return id/size.`);
    }
  } catch (e: any) {
    core.warning(`Failed to upload SARIF as artifact: ${e?.message || e}`);
  }
}
