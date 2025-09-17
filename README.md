# Static Security Analysis Action

This GitHub Action runs static security analysis using a JAR file and generates SARIF results that can be uploaded to GitHub's Code Scanning.

## Prerequisites

- The analysis JAR file must be located at `tool/analysis.jar` in your repository
- Java runtime must be available in the runner environment

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `jbai-token` | JBAI token for authentication | Yes | - |
| `model` | Model to use for analysis | No | - |
| `repo-path` | Path to the repository to analyze | No | `.` |
| `temperature` | Temperature parameter for analysis | No | `0.0` |

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
        model: 'gpt-4'
        temperature: '0.1'
    
    - name: Upload SARIF to GitHub
      uses: github/codeql-action/upload-sarif@v3
      if: always()
      with:
        sarif_file: ${{ steps.security-scan.outputs.sarif-file }}
        category: security-analysis
```

## SARIF Output

The action generates a `security-review.sarif` file in the specified repository path. This file contains security findings in the SARIF 2.1.0 format that can be uploaded to GitHub's Code Scanning for PR annotations.

## Environment Variables

The action sets the `JBAI_TOKEN` environment variable for the JAR file execution.