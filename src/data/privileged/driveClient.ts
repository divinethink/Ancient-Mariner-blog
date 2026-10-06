// Privileged allowlist ৬ (Arch §২): backup job-এর Google Drive access — OAuth refresh token, scope `drive.file` (শুধু অ্যাপের নিজের বানানো ফাইল)।
// Service account Drive-এ লিখতে পারে না (My Drive-এ quota নেই), তাই OAuth। কেবল scripts/backup.ts (Node, GitHub Actions) থেকে import।
// token/secret কখনো log বা error-বার্তায় যায় না (error-এ শুধু HTTP status)।
import { withRetry } from "../retry";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const UPLOAD_TIMEOUT_MS = 90_000;

export type DriveFile = { id: string; name: string; size?: number };
export type DriveFolderInfo = { id: string; name: string };

export type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
};

const ID_RE = /^[A-Za-z0-9_-]{5,200}$/;
const assertId = (id: string) => {
  if (!ID_RE.test(id)) throw new Error("অবৈধ Drive id");
};
/** Drive query-র একক-উদ্ধৃতি স্ট্রিংয়ের জন্য escape */
const q = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export function createDriveClient(cfg: DriveConfig) {
  const { clientId, clientSecret, refreshToken, fetchImpl = fetch, nowMs = Date.now } = cfg;
  let cached: { token: string; expMs: number } | null = null;

  async function token(): Promise<string> {
    if (cached && cached.expMs - 60_000 > nowMs()) return cached.token;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await withRetry(async (signal) => {
      const r = await fetchImpl(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal,
      });
      // 400/401 = refresh token বাতিল/মেয়াদোত্তীর্ণ (যেমন consent screen Testing-এ) — retry বৃথা, তাই throw নয়, নিচে স্পষ্ট বার্তা
      if (r.status === 400 || r.status === 401) return { rejected: r.status } as const;
      if (!r.ok) throw new Error(`Drive OAuth ${r.status}`);
      return (await r.json()) as {
        access_token?: string;
        expires_in?: number;
        rejected?: undefined;
      };
    });
    if (res.rejected)
      throw new Error(
        `Drive OAuth refresh ব্যর্থ (${res.rejected}) — refresh token/consent screen দেখুন`,
      );
    if (!res.access_token) throw new Error("Drive OAuth: access_token নেই");
    cached = { token: res.access_token, expMs: nowMs() + (res.expires_in ?? 3600) * 1000 };
    return cached.token;
  }

  async function call<T>(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
    ok: number[] = [200],
  ): Promise<T | null> {
    const res = await fetchImpl(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        authorization: `Bearer ${await token()}`,
      },
      signal,
    });
    if (!ok.includes(res.status)) throw new Error(`Drive ${res.status}`);
    return res.status === 204 ? null : ((await res.json()) as T);
  }

  const toFile = (f: { id: string; name: string; size?: string }): DriveFile => ({
    id: f.id,
    name: f.name,
    size: f.size === undefined ? undefined : Number(f.size),
  });

  async function listAll(
    query: string,
    fields: string,
  ): Promise<{ id: string; name: string; size?: string }[]> {
    const out: { id: string; name: string; size?: string }[] = [];
    let pageToken: string | undefined;
    do {
      const url =
        `${API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}` +
        `&pageSize=100&spaces=drive${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const j = await withRetry((s) =>
        call<{ files?: { id: string; name: string; size?: string }[]; nextPageToken?: string }>(
          url,
          { method: "GET" },
          s,
        ),
      );
      out.push(...(j?.files ?? []));
      pageToken = j?.nextPageToken;
    } while (pageToken);
    return out;
  }

  return {
    /** My Drive-এর মূলে নতুন ফোল্ডার (retry-তে duplicate এড়াতে আগে নামে খোঁজে) */
    async createFolder(name: string): Promise<DriveFolderInfo> {
      const found = await listAll(
        `mimeType=${q(FOLDER_MIME)} and trashed=false and name=${q(name)}`,
        "id,name",
      );
      if (found.length > 0) return { id: found[0].id, name: found[0].name };
      const j = await withRetry((s) =>
        call<{ id: string; name: string }>(
          `${API}/files?fields=id,name`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
          },
          s,
        ),
      );
      if (!j) throw new Error("Drive: ফোল্ডার তৈরি হয়নি");
      return { id: j.id, name: j.name };
    },

    /** অ্যাপের নিজের বানানো (`drive.file`), ট্র্যাশে-নেই, নাম-prefix মেলা ফোল্ডার */
    async listBackupFolders(prefix: string): Promise<DriveFolderInfo[]> {
      // drive.file-এ শুধু অ্যাপের নিজের ফোল্ডার আসে; `contains` token-ভিত্তিক (হাইফেনে অনির্ভরযোগ্য) তাই prefix এখানে মেলানো
      const files = await listAll(`mimeType=${q(FOLDER_MIME)} and trashed=false`, "id,name");
      return files.filter((f) => f.name.startsWith(prefix)).map(({ id, name }) => ({ id, name }));
    },

    async listFiles(folderId: string): Promise<DriveFile[]> {
      assertId(folderId);
      return (await listAll(`${q(folderId)} in parents and trashed=false`, "id,name,size")).map(
        toFile,
      );
    },

    /**
     * JSON ফাইল আপলোড; ফেরত Drive-এর নিজের জানানো আকার। retry-তে আগে ফোল্ডারে ঐ নাম খোঁজে —
     * আগের চেষ্টা আসলে সফল হলে (সঠিক আকার) আবার আপলোড নয়; ভুল আকার হলে মুছে আবার।
     */
    async uploadJson(folderId: string, name: string, content: string): Promise<DriveFile> {
      assertId(folderId);
      const bytes = Buffer.from(content, "utf8");
      let attempt = 0;
      return withRetry(
        async (signal) => {
          if (attempt++ > 0) {
            for (const f of (await this.listFiles(folderId)).filter((x) => x.name === name)) {
              if (f.size === bytes.length) return f;
              await withRetry((s) => call(`${API}/files/${f.id}`, { method: "DELETE" }, s, [204]));
            }
          }
          const boundary = `bk${crypto.randomUUID().replace(/-/g, "")}`;
          const meta = JSON.stringify({ name, parents: [folderId], mimeType: "application/json" });
          const body = Buffer.concat([
            Buffer.from(
              `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: application/json\r\n\r\n`,
            ),
            bytes,
            Buffer.from(`\r\n--${boundary}--`),
          ]);
          const j = await call<{ id: string; name: string; size?: string }>(
            `${UPLOAD}/files?uploadType=multipart&fields=id,name,size`,
            {
              method: "POST",
              headers: { "content-type": `multipart/related; boundary=${boundary}` },
              body,
            },
            signal,
          );
          if (!j) throw new Error("Drive: আপলোড-উত্তর নেই");
          return toFile(j);
        },
        { timeoutMs: UPLOAD_TIMEOUT_MS, retries: 3 },
      );
    },

    /** ফোল্ডার (ও ভেতরের সব) স্থায়ীভাবে মোছে; ইতিমধ্যে নেই (404) = সফল। শুধু caller-যাচাই-করা অ্যাপ-ফোল্ডারে */
    async deleteFolder(folderId: string): Promise<void> {
      assertId(folderId);
      await withRetry(async (signal) => {
        const res = await fetchImpl(`${API}/files/${folderId}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${await token()}` },
          signal,
        });
        if (res.status !== 204 && res.status !== 404) throw new Error(`Drive ${res.status}`);
      });
    },
  };
}
export type DriveClient = ReturnType<typeof createDriveClient>;
