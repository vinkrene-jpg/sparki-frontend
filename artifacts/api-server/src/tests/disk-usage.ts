import { probeProjectDiskSize, classifyDiskUsage, GIT_WARN_BYTES, TOTAL_WARN_BYTES, TOTAL_CRITICAL_BYTES } from "../lib/health/disk-usage";

// Unit: classification thresholds
const G = 1024 ** 3;
const mk = (git: number, total: number) => classifyDiskUsage({ gitBytes: git, totalBytes: total, offenders: [{ name: ".git", bytes: git }] }, 1);
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
assert(mk(0.4 * G, 3 * G).status === "green", "klein project = green");
assert(mk(1.1 * G, 3 * G).status === "orange", ".git > 1,0 GB = orange (eerder waarschuwen)");
assert(mk(0.4 * G, 5.5 * G).status === "orange", "totaal > 5 GiB = orange (eerder waarschuwen)");
assert(mk(0.4 * G, 7.5 * G).status === "red", "totaal > 7,25 GiB = red/critical");
assert(mk(0.99 * G, 4.9 * G).status === "green", "net onder drempels = green (geen false alarm)");

// Live probe
const r = await probeProjectDiskSize();
console.log("LIVE:", r.status, "-", r.message);
console.log("DETAILS:", r.technicalDetails);
