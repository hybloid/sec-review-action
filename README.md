# Static Security Analysis Action

This GitHub Action runs static security analysis using a JAR file, generates SARIF results, and optionally annotates pull requests based on SARIF findings. The implementation is written in TypeScript and bundled for the GitHub Actions runtime.

## Prerequisites

- The analysis JAR file must be located at `tool/analysis.jar` in your repository
- Java runtime must be available in the runner environment

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
| `github-token` | Token used to annotate PRs (use `${{ secrets.GITHUB_TOKEN }}`) | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `sarif-file` | Path to the generated SARIF file |

## Example Usage

```yaml
name: Security Analysis
on:
  pull_request:
    branches: [ main ]

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
    
    - name: Set up Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '11'
    
    - name: Run Security Analysis
      id: security-scan
      uses: your-username/static-security-analysis-action@v1
      with:
        jbai-token: ${{ secrets.JBAI_TOKEN }}
        github-token: ${{ secrets.GITHUB_TOKEN }}
        model: 'gpt-4'
        temperature: '0.1'
        result-path: '.'
    
    - name: Upload SARIF to GitHub
      uses: github/codeql-action/upload-sarif@v3
      if: always()
      with:
        sarif_file: ${{ steps.security-scan.outputs.sarif-file }}
        category: security-analysis
```

## SARIF Output and PR Annotations

The action generates a `security-review.sarif` file in the specified `result-path`. This file contains security findings in the SARIF 2.1.0 format that can be uploaded to GitHub's Code Scanning. If the workflow runs on a pull_request event and `github-token` is provided, the action will parse the SARIF file and create a PR review with line comments where issues are found.

## Environment Variables

The action sets the following environment variables for the JAR file execution:
- `JBAI_TOKEN`
- `JBAI_ENVIRONMENT`