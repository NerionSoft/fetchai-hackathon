/**
 * GET /api/classroom/demo — returns the bundled demo lesson (with deliberate
 * flaws) so the deposit page can prefill it in one click.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const path = join(process.cwd(), "content", "lessons", "interets-composes.md");
    const markdown = await readFile(path, "utf8");
    const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? "Demo lesson";
    return Response.json({ title, markdown });
  } catch {
    return Response.json({ error: "Demo lesson not found." }, { status: 404 });
  }
}
