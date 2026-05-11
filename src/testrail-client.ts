import axios, { AxiosInstance, AxiosError } from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import { TestrailCase, TestrailResult, TestrailRun } from './types';

export class TestrailClient {
  private client: AxiosInstance;

  constructor(host: string, username: string, apiKey: string) {
    this.client = axios.create({
      baseURL: `${host.replace(/\/$/, '')}/index.php?/api/v2`,
      auth: { username, password: apiKey },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });

    // Attach response interceptor for clear error messages
    this.client.interceptors.response.use(
      (res) => res,
      (err: AxiosError<{ error?: string }>) => {
        const msg =
          err.response?.data?.error ??
          err.message ??
          'Unknown TestRail API error';
        const status = err.response?.status;
        throw new Error(`TestRail API [${status ?? 'network'}]: ${msg}`);
      }
    );
  }

  // ─── Runs ─────────────────────────────────

  async createRun(
    projectId: number,
    name: string,
    opts: {
      suiteId?: number;
      milestoneId?: number;
      assignedToId?: number;
      caseIds?: number[];
    } = {}
  ): Promise<TestrailRun> {
    const payload: Record<string, unknown> = {
      name,
      include_all: opts.caseIds ? false : true,
    };
    if (opts.suiteId) payload.suite_id = opts.suiteId;
    if (opts.milestoneId) payload.milestone_id = opts.milestoneId;
    if (opts.assignedToId) payload.assignedto_id = opts.assignedToId;
    if (opts.caseIds?.length) payload.case_ids = opts.caseIds;

    const { data } = await this.client.post<TestrailRun>(
      `/add_run/${projectId}`,
      payload
    );
    return data;
  }

  async getRun(runId: number): Promise<TestrailRun> {
    const { data } = await this.client.get<TestrailRun>(`/get_run/${runId}`);
    return data;
  }

  async closeRun(runId: number): Promise<void> {
    await this.client.post(`/close_run/${runId}`);
  }

  // ─── Results ──────────────────────────────

  async addResult(
    runId: number,
    caseId: number,
    result: {
      statusId: number;
      comment?: string;
      elapsed?: string;
      version?: string;
    }
  ): Promise<TestrailResult> {
    const { data } = await this.client.post<TestrailResult>(
      `/add_result_for_case/${runId}/${caseId}`,
      {
        status_id: result.statusId,
        comment: result.comment,
        elapsed: result.elapsed,
        version: result.version,
      }
    );
    return data;
  }

  async addResultsBulk(
    runId: number,
    results: Array<{
      caseId: number;
      statusId: number;
      comment?: string;
      elapsed?: string;
    }>
  ): Promise<TestrailResult[]> {
    const { data } = await this.client.post<{ results: TestrailResult[] }>(
      `/add_results_for_cases/${runId}`,
      {
        results: results.map((r) => ({
          case_id: r.caseId,
          status_id: r.statusId,
          comment: r.comment,
          elapsed: r.elapsed,
        })),
      }
    );
    return data.results;
  }

  // ─── Attachments ──────────────────────────

  async uploadAttachment(resultId: number, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Attachment not found: ${filePath}`);
    }

    const form = new FormData();
    form.append('attachment', fs.createReadStream(filePath));

    await this.client.post(
      `/add_attachment_to_result/${resultId}`,
      form,
      { headers: form.getHeaders() }
    );
  }

  // ─── Cases ────────────────────────────────

  async getCase(caseId: number): Promise<TestrailCase> {
    const { data } = await this.client.get<TestrailCase>(`/get_case/${caseId}`);
    return data;
  }

  async getCases(
    projectId: number,
    opts: { suiteId?: number; sectionId?: number } = {}
  ): Promise<TestrailCase[]> {
    let url = `/get_cases/${projectId}`;
    const params: string[] = [];
    if (opts.suiteId) params.push(`suite_id=${opts.suiteId}`);
    if (opts.sectionId) params.push(`section_id=${opts.sectionId}`);
    if (params.length) url += `&${params.join('&')}`;

    const { data } = await this.client.get<{ cases: TestrailCase[] }>(url);
    return data.cases ?? [];
  }

  async addCase(
    sectionId: number,
    title: string,
    opts: { typeId?: number; priorityId?: number } = {}
  ): Promise<TestrailCase> {
    const { data } = await this.client.post<TestrailCase>(
      `/add_case/${sectionId}`,
      {
        title,
        type_id: opts.typeId ?? 1,       // 1 = Automated
        priority_id: opts.priorityId ?? 2, // 2 = Medium
      }
    );
    return data;
  }
}
