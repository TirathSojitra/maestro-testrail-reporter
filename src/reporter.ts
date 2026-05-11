import { ReporterConfig, STATUS, TestrailRun } from './types';
import { TestrailClient } from './testrail-client';
import { parseMaestroResults } from './maestro-parser';
import { log } from './logger';

export interface ReporterSummary {
  runId: number | null;
  runUrl: string | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
}

export async function runReporter(config: ReporterConfig): Promise<ReporterSummary> {
  const {
    testrail,
    maestro,
    uploadAttachments = true,
    createMissingCases = false,
    defaultSectionId,
    caseIdPattern = /C(\d+)/,
    dryRun = false,
  } = config;

  // ── 1. Parse Maestro results ─────────────────────────────────────────────
  log.header('Parsing Maestro results');
  const results = await parseMaestroResults(maestro.resultsDir, caseIdPattern);
  log.info(`Found ${results.length} test result(s) in ${maestro.resultsDir}`);

  const withCaseId = results.filter((r) => r.caseId !== null);
  const withoutCaseId = results.filter((r) => r.caseId === null);

  if (withoutCaseId.length > 0) {
    log.warn(`${withoutCaseId.length} flow(s) have no TestRail case ID and will be skipped:`);
    withoutCaseId.forEach((r) => log.dim(`  • ${r.name}`));
  }

  if (dryRun) {
    log.header('Dry-run results (not posted to TestRail)');
    results.forEach((r) => log.result(r.passed, r.name, r.caseId));
    return {
      runId: null,
      runUrl: null,
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      skipped: withoutCaseId.length,
      dryRun: true,
    };
  }

  // ── 2. Set up TestRail client & run ──────────────────────────────────────
  const client = new TestrailClient(testrail.host, testrail.username, testrail.apiKey);

  let run: TestrailRun;
  if (testrail.existingRunId) {
    log.info(`Using existing TestRail run: #${testrail.existingRunId}`);
    run = await client.getRun(testrail.existingRunId);
  } else {
    const runName = testrail.runName ?? `Maestro Run – ${new Date().toISOString()}`;
    log.header('Creating TestRail run');
    log.info(`Name: ${runName}`);
    run = await client.createRun(testrail.projectId, runName, {
      suiteId: testrail.suiteId,
      milestoneId: testrail.milestoneId,
      assignedToId: testrail.assignedToId,
    });
    log.success(`Run created: #${run.id}`);
  }

  // ── 3. Auto-create missing cases (optional) ───────────────────────────────
  let processable = withCaseId;

  if (createMissingCases && withoutCaseId.length > 0) {
    if (!defaultSectionId) {
      log.warn('createMissingCases is true but defaultSectionId is not set – skipping auto-create.');
    } else {
      log.header('Creating missing TestRail cases');
      for (const r of withoutCaseId) {
        try {
          const newCase = await client.addCase(defaultSectionId, r.name);
          log.success(`Created case C${newCase.id} for: ${r.name}`);
          r.caseId = newCase.id;
          processable.push(r);
        } catch (err) {
          log.error(`Failed to create case for "${r.name}": ${(err as Error).message}`);
        }
      }
    }
  }

  // ── 4. Post results ───────────────────────────────────────────────────────
  log.header('Posting results to TestRail');

  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const result of processable) {
    if (result.caseId === null) {
      skippedCount++;
      continue;
    }

    const comment = buildComment(result.passed, result.failureReason);
    const elapsed = result.duration > 0 ? `${Math.ceil(result.duration)}s` : undefined;

    let trResult;
    try {
      trResult = await client.addResult(run.id, result.caseId, {
        statusId: result.passed ? STATUS.PASSED : STATUS.FAILED,
        comment,
        elapsed,
      });
    } catch (err) {
      log.error(
        `Could not post result for C${result.caseId} ("${result.name}"): ${(err as Error).message}`
      );
      skippedCount++;
      continue;
    }

    log.result(result.passed, result.name, result.caseId);
    result.passed ? passedCount++ : failedCount++;

    // ── 5. Upload attachments ────────────────────────────────────────────
    if (uploadAttachments && trResult) {
      const attachments = [
        ...result.screenshotPaths,
        ...(result.videoPath ? [result.videoPath] : []),
      ];

      for (const filePath of attachments) {
        try {
          await client.uploadAttachment(trResult.id, filePath);
          const label = filePath.endsWith('.mp4') || filePath.endsWith('.mov')
            ? '🎥'
            : '📸';
          log.dim(`     ${label} Uploaded: ${filePath.split('/').pop()}`);
        } catch (err) {
          log.warn(`     Could not upload ${filePath}: ${(err as Error).message}`);
        }
      }
    }
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const runUrl = `${testrail.host.replace(/\/$/, '')}/index.php?/runs/view/${run.id}`;

  log.header('Summary');
  log.success(`Passed:  ${passedCount}`);
  if (failedCount > 0) log.error(`Failed:  ${failedCount}`);
  if (skippedCount > 0) log.warn(`Skipped: ${skippedCount} (no case ID or post error)`);
  log.info(`Run URL: ${runUrl}`);

  return {
    runId: run.id,
    runUrl,
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    skipped: skippedCount,
    dryRun: false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildComment(passed: boolean, failureReason?: string): string {
  if (passed) {
    return '✅ Test passed via Maestro';
  }
  const lines = ['❌ Test failed via Maestro'];
  if (failureReason) {
    lines.push('', '**Failure reason:**', '```', failureReason, '```');
  }
  return lines.join('\n');
}
