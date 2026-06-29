// One-off: export the most-recently (re)generated world feed photos to disk so
// they can be reviewed. NOT part of the product — remove after use.
import { writeFileSync, mkdirSync } from "node:fs";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { db, pool, virtualMediaTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const OUT = "/home/runner/workspace/.local/world-samples";
const svc = new ObjectStorageService();

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const rows = await db
    .select({
      id: virtualMediaTable.id,
      promptKey: virtualMediaTable.promptKey,
      objectPath: virtualMediaTable.objectPath,
    })
    .from(virtualMediaTable)
    .where(
      and(
        eq(virtualMediaTable.purpose, "post"),
        eq(virtualMediaTable.status, "ready"),
        isNotNull(virtualMediaTable.objectPath),
      ),
    )
    .orderBy(desc(virtualMediaTable.id))
    .limit(8);

  let i = 0;
  for (const r of rows) {
    if (!r.objectPath) continue;
    const bytes = await svc.getObjectBytes(r.objectPath);
    const ext = bytes.mimeType.includes("jpeg") ? "jpg" : "png";
    const file = `${OUT}/new-${String(i).padStart(2, "0")}-${r.id}.${ext}`;
    writeFileSync(file, Buffer.from(bytes.base64, "base64"));
    console.log(`wrote ${file}  (${r.promptKey.slice(0, 60)})`);
    i++;
  }
  console.log(`done: ${i} images`);
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
