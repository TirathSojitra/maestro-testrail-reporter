import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { MaestroTestResult } from './types';

interface JUnitTestCase {
  $: { name: string; classname?: string; time?: string };
  failure?: Array<{ _?: string; $?: { message?: string; type?: string } }>;
  error?: Array<{ _?: string; $?: { message?: string } }>;
  'system-out'?: string[];
}

interface JUnitTestSuite {
  $: { name: string; tests?: string; failures?: string; time?: string };
  testcase?: JUnitTestCase[];
  testsuite?: JUnitTestSuite[];
}

interface JUnitRoot {
  testsuite?: JUnitTestSuite;
  testsuites?: { testsuite?: JUnitTestSuite[] };
}

/**
 * Parse Maestro JUnit XML output directory into structured test results.
 *
 * Maestro writes one XML file per flow (or a combined report depending on
 * the runner version), plus a folder of screenshots and an optional video
 * for each flow.
 *
 * Expected directory layout:
 *   resultsDir/
 *     report.xml          ← combined JUnit report (maestro test --format junit)
 *     *.xml               ← or individual per-flow XMLs
 *     <FlowName>/
 *       screenshot-0.png
 *       screenshot-1.png
 *       video.mp4
 */
export async function parseMaestroResults(
  resultsDir: string,
  caseIdPattern: RegExp = /C(\d+)/
): Promise<MaestroTestResult[]> {
  if (!fs.existsSync(resultsDir)) {
    throw new Error(`Maestro results directory not found: ${resultsDir}`);
  }

  const xmlFiles = fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith('.xml'))
    .map((f) => path.join(resultsDir, f));

  if (xmlFiles.length === 0) {
    throw new Error(
      `No XML result files found in: ${resultsDir}\n` +
      'Run Maestro with: maestro test --format junit <flows>'
    );
  }

  const allResults: MaestroTestResult[] = [];

  for (const xmlFile of xmlFiles) {
    const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
    const parsed = await xml2js.parseStringPromise(xmlContent, {
      explicitArray: true,
      trim: true,
    }) as JUnitRoot;

    const suites = collectSuites(parsed);

    for (const suite of suites) {
      const testcases = suite.testcase ?? [];
      for (const tc of testcases) {
        allResults.push(buildResult(tc, resultsDir, caseIdPattern));
      }
    }
  }

  return deduplicateResults(allResults);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectSuites(root: JUnitRoot): JUnitTestSuite[] {
  if (root.testsuites?.testsuite) return root.testsuites.testsuite;
  if (root.testsuite) return [root.testsuite];
  return [];
}

function buildResult(
  tc: JUnitTestCase,
  resultsDir: string,
  caseIdPattern: RegExp
): MaestroTestResult {
  const name = tc.$.name ?? tc.$.classname ?? 'Unknown';
  const duration = parseFloat(tc.$.time ?? '0');

  // Prefer failure over error; extract the human-readable message
  const failureNode = tc.failure?.[0] ?? tc.error?.[0];
  const passed = failureNode === undefined;

  let failureReason: string | undefined;
  if (failureNode) {
    failureReason =
      failureNode.$?.message ??
      failureNode._ ??
      'Test failed (no message captured)';
    // Trim to avoid massive stack traces in TestRail comments
    if (failureReason.length > 2000) {
      failureReason = failureReason.slice(0, 2000) + '\n… (truncated)';
    }
  }

  // Extract TestRail case ID using the configured pattern
  const match = name.match(caseIdPattern);
  const caseId = match ? parseInt(match[1], 10) : null;

  // Locate screenshots and video from the per-flow media folder
  // Maestro names the folder after the flow file (without extension)
  const flowBaseName = sanitizeFolderName(name);
  const mediaDir = path.join(resultsDir, flowBaseName);
  const screenshotPaths = getScreenshots(mediaDir);
  const videoPath = getVideo(mediaDir);

  return {
    name,
    caseId,
    passed,
    duration,
    failureReason,
    screenshotPaths,
    videoPath,
  };
}

function sanitizeFolderName(name: string): string {
  // Maestro strips special chars and spaces from folder names
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function getScreenshots(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function getVideo(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const video = fs
    .readdirSync(dir)
    .find((f) => /\.(mp4|mov|webm)$/i.test(f));
  return video ? path.join(dir, video) : undefined;
}

/** Remove duplicates by flow name (can occur with combined + individual XMLs) */
function deduplicateResults(results: MaestroTestResult[]): MaestroTestResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
