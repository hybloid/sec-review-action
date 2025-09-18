# Static Security Analysis Action

This GitHub Action runs static security analysis using a JAR file, generates SARIF results, and optionally annotates pull requests based on SARIF findings.

## Prerequisites

- Java runtime must be available in the runner environment
- While running, action fetches the latest version of the analyzer from own Releases. At least one release must be available.
- PAT token for the repo with analyzer is required to release the action

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `jbai-token` | JBAI token for authentication | Yes | - |
| `jbai-environment` | JBAI environment (e.g., staging, prod) | No | `staging` |
| `model` | Model to use for analysis | No | - |
| `repo-path` | Path to the repository to analyze | No | `.` |
| `result-path` | Path where results (including SARIF) will be written | No | `.` |
| `temperature` | Temperature parameter for analysis | No | `0.0` |
| `prompt` | Optional prompt to pass to the analyzer | No | - |
| `authType` | Optional authentication type to pass to the analyzer (e.g., gh-app, pat) | No | - |
| `branch` | Optional branch name to analyze | No | - |
| `github-token` | Token used to annotate PRs (use `${{ secrets.GITHUB_TOKEN }}`) | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `sarif-file` | Path to the generated SARIF file |

## Development

If logic gets changed, please run `npm run build` to update the `dist` folder and commit the changes, GH Actions are using
packed sources and don't allow to modify published action blob (to our knowledge).

Tests currently cover only basic functionality - SARIF processing and artifact download.

## Example Usage

```yaml
name: Security Analysis
on:
  pull_request:
    branches: [ master ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      actions: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
      - name: Run Security Analysis
        uses: hybloid/sec-review-action@main
        with:
          jbai-token: ${{ secrets.JBAI_TOKEN }}
          jbai-environment: 'production'
          temperature: '0.0'
          branch: ${{ github.event.pull_request.base.ref }}
```

## SARIF Output and PR Annotations

The action generates a `security-review.sarif` file in the specified `result-path`. This file contains security findings in the SARIF 2.1.0 format that can be uploaded to GitHub's Code Scanning. If the workflow runs on a pull_request event and `github-token` is provided, the action will parse the SARIF file and create a PR review with line comments where issues are found.
