// --- methods, after importStarterPack in ConsoleClient ---

  async contentUploads(): Promise<readonly ContentUploadSummary[]> {
    return (await this.#request<{ uploads: ContentUploadSummary[] }>("/practice-admin/content/uploads")).uploads;
  }

  contentUpload(id: string): Promise<ContentUpload> {
    return this.#request(`/practice-admin/content/uploads/${encodeURIComponent(id)}`);
  }

  /** A bundle, its bytes in base64: the schema and rules are checked at once, the runner's gates after. */
  uploadContent(name: string, file: string): Promise<ContentUpload> {
    return this.#request("/practice-admin/content/uploads", { method: "POST", body: JSON.stringify({ name, file }) });
  }

  /** Publish an upload's drafts: those named, or every one that passed. */
  publishContent(upload: string, items?: readonly { namespace: "problem" | "lesson"; slug: string }[]): Promise<ContentPublished> {
    return this.#request("/practice-admin/content/publish", { method: "POST", body: JSON.stringify(items === undefined ? { upload } : { upload, items }) });
  }

// --- types, after StarterPack ---

/** One thing a gate found wrong. */
export interface ContentProblem {
  readonly gate: string;
  readonly message: string;
}

export interface ContentUploadSummary {
  readonly id: string;
  readonly bundleId: string;
  readonly bundleVersion: number;
  readonly title: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly state: "checking" | "done";
  readonly createdBy: { readonly id: string; readonly name: string };
  readonly createdAt: string;
  readonly finishedAt: string | null;
  readonly counts: { readonly total: number; readonly pending: number; readonly checking: number; readonly passed: number; readonly failed: number; readonly skipped: number };
  readonly published: number;
}

export interface ContentUploadItem {
  readonly position: number;
  readonly namespace: "problem" | "lesson";
  readonly slug: string;
  readonly type: string;
  readonly version: number;
  readonly hash: string;
  readonly title: string;
  readonly status: "pending" | "checking" | "passed" | "failed" | "skipped";
  readonly problems: readonly ContentProblem[];
  readonly warnings: readonly string[];
  readonly checkedAt: string | null;
  readonly current: { readonly version: number; readonly hash: string; readonly state: "draft" | "published"; readonly publishedVersion: number | null; readonly uploadId: string } | null;
}

export interface ContentUpload extends ContentUploadSummary {
  readonly manifest: unknown;
  readonly problems: readonly ContentProblem[];
  readonly items: readonly ContentUploadItem[];
}

export interface ContentPublished {
  readonly published: readonly { readonly namespace: "problem" | "lesson"; readonly slug: string; readonly version: number }[];
  readonly refused: readonly { readonly namespace: "problem" | "lesson"; readonly slug: string; readonly message: string }[];
}
