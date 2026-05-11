// ─────────────────────────────────────────────
//  Configuration types
// ─────────────────────────────────────────────

export interface TestrailConfig {
  /** Full TestRail host URL e.g. https://yourorg.testrail.io */
  host: string;
  /** TestRail account email */
  username: string;
  /** TestRail API key (Account Settings → API Keys) */
  apiKey: string;
  /** Target TestRail project ID */
  projectId: number;
  /** Optional suite ID (required for multi-suite projects) */
  suiteId?: number;
  /** Custom run name. Defaults to "Maestro Run – <ISO timestamp>" */
  runName?: string;
  /** Attach results to an existing run ID instead of creating a new one */
  existingRunId?: number;
  /** Milestone ID to associate the run with */
  milestoneId?: number;
  /** Assign run to this user ID */
  assignedToId?: number;
}

export interface MaestroConfig {
  /** Directory where Maestro writes its XML + media output */
  resultsDir: string;
  /** Optional app identifier for logging */
  appId?: string;
}

export interface ReporterConfig {
  testrail: TestrailConfig;
  maestro: MaestroConfig;
  /**
   * Upload screenshots and videos as attachments.
   * @default true
   */
  uploadAttachments?: boolean;
  /**
   * Automatically create a TestRail test case when none is found for a flow.
   * @default false
   */
  createMissingCases?: boolean;
  /**
   * Section ID used when auto-creating missing test cases.
   * Required when createMissingCases is true.
   */
  defaultSectionId?: number;
  /**
   * Regex to extract the TestRail case ID from the flow name.
   * Must capture the numeric ID in group 1.
   * @default /C(\d+)/
   */
  caseIdPattern?: RegExp;
  /**
   * Dry-run mode: parse & log results without posting to TestRail.
   * @default false
   */
  dryRun?: boolean;
}

// ─────────────────────────────────────────────
//  Internal result types
// ─────────────────────────────────────────────

export interface MaestroTestResult {
  /** Raw flow name from JUnit XML */
  name: string;
  /** Extracted TestRail case ID (null if not found) */
  caseId: number | null;
  passed: boolean;
  /** Duration in seconds */
  duration: number;
  failureReason?: string;
  screenshotPaths: string[];
  videoPath?: string;
}

export interface TestrailRun {
  id: number;
  name: string;
  url: string;
}

export interface TestrailResult {
  id: number;
  test_id: number;
  status_id: number;
  comment: string;
}

export interface TestrailCase {
  id: number;
  title: string;
  section_id: number;
}

// ─────────────────────────────────────────────
//  Status IDs (TestRail defaults)
// ─────────────────────────────────────────────

export const STATUS = {
  PASSED: 1,
  BLOCKED: 2,
  UNTESTED: 3,
  RETEST: 4,
  FAILED: 5,
} as const;
