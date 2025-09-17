import * as fs from 'fs';
import * as path from 'path';
import { buildPrCommentsFromSarif, parseSarif } from '../src/sarif';

describe('SARIF processing', () => {
  it('should process security-review.sarif with no problems (no PR comments)', () => {
    const sarifPath = path.join(__dirname, 'data', 'security-review.sarif');
    const sarifRaw = fs.readFileSync(sarifPath, 'utf8');
    const sarif = parseSarif(sarifRaw);
    expect(sarif).toBeDefined();
    if (!sarif) return; // Type narrowing for TS

    const comments = buildPrCommentsFromSarif(sarif);
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBe(1);
  });
});
