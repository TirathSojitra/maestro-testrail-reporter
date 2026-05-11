import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseMaestroResults } from '../src/maestro-parser';

const PASSING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Maestro" tests="1" failures="0" time="5.2">
  <testcase name="Login Flow C1001" classname="com.example.app" time="5.2"/>
</testsuite>`;

const FAILING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Maestro" tests="1" failures="1" time="3.1">
  <testcase name="Checkout Flow C1002" classname="com.example.app" time="3.1">
    <failure message="Element not found: Add to Cart button">
      com.maestro.exception.MaestroException: Element not found
        at flow line 12
    </failure>
  </testcase>
</testsuite>`;

const MULTI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Suite1">
    <testcase name="Flow A C2001" time="2.0"/>
    <testcase name="Flow B C2002" time="1.5">
      <failure message="Timeout">timeout after 30s</failure>
    </testcase>
    <testcase name="Flow C – no case id" time="1.0"/>
  </testsuite>
</testsuites>`;

function makeTempDir(xmlContent: string, filename = 'report.xml'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-test-'));
  fs.writeFileSync(path.join(dir, filename), xmlContent);
  return dir;
}

describe('parseMaestroResults', () => {
  it('parses a passing test correctly', async () => {
    const dir = makeTempDir(PASSING_XML);
    const results = await parseMaestroResults(dir);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Login Flow C1001');
    expect(results[0].passed).toBe(true);
    expect(results[0].caseId).toBe(1001);
    expect(results[0].duration).toBeCloseTo(5.2);
    expect(results[0].failureReason).toBeUndefined();

    fs.rmSync(dir, { recursive: true });
  });

  it('parses a failing test correctly', async () => {
    const dir = makeTempDir(FAILING_XML);
    const results = await parseMaestroResults(dir);

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].caseId).toBe(1002);
    expect(results[0].failureReason).toContain('Element not found');

    fs.rmSync(dir, { recursive: true });
  });

  it('handles testsuites root element', async () => {
    const dir = makeTempDir(MULTI_XML);
    const results = await parseMaestroResults(dir);

    expect(results).toHaveLength(3);
    expect(results[0].caseId).toBe(2001);
    expect(results[1].caseId).toBe(2002);
    expect(results[1].passed).toBe(false);
    expect(results[2].caseId).toBeNull(); // no case id

    fs.rmSync(dir, { recursive: true });
  });

  it('throws when directory does not exist', async () => {
    await expect(parseMaestroResults('/nonexistent/path')).rejects.toThrow(
      'not found'
    );
  });

  it('throws when no XML files are present', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
    await expect(parseMaestroResults(dir)).rejects.toThrow('No XML result files');
    fs.rmSync(dir, { recursive: true });
  });

  it('uses custom case ID pattern', async () => {
    const xml = `<testsuite><testcase name="TestID:9999 My Flow" time="1"/></testsuite>`;
    const dir = makeTempDir(xml);
    const results = await parseMaestroResults(dir, /TestID:(\d+)/);

    expect(results[0].caseId).toBe(9999);
    fs.rmSync(dir, { recursive: true });
  });

  it('collects screenshot paths when media dir exists', async () => {
    const dir = makeTempDir(PASSING_XML);
    const mediaDir = path.join(dir, 'Login_Flow_C1001');
    fs.mkdirSync(mediaDir);
    fs.writeFileSync(path.join(mediaDir, 'screenshot-0.png'), '');
    fs.writeFileSync(path.join(mediaDir, 'screenshot-1.png'), '');

    const results = await parseMaestroResults(dir);
    expect(results[0].screenshotPaths).toHaveLength(2);

    fs.rmSync(dir, { recursive: true });
  });
});
