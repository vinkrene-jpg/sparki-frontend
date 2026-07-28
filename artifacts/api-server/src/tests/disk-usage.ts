import { probeProjectDiskSize, classifyDiskUsage, GIT_WARN_BYTES, TOTAL_WARN_BYTES, TOTAL_CRITICAL_BYTES } from "../lib/health/disk-usage";

// Unit: classification thresholds
const G = 1024 ** 3;
const mk = (git: number, total: number) => classifyDiskUsage({ gitBytes: git, totalBytes: total, offenders: [{ name: ".git", bytes: git }] }, 1);
const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
assert(mk(0.4 * G, 3 * G).status === "green", "klein project = green");
assert(mk(1.6 * G, 3 * G).status === "orange", ".git > 1,5 GB = orange");
assert(mk(0.4 * G, 6.5 * G).status === "orange", "totaal > 6 GiB = orange");
assert(mk(0.4 * G, 7.5 * G).status === "red", "totaal > 7,25 GiB = red/critical");
assert(mk(1.49 * G, 5.9 * G).status === "green", "net onder drempels = green (geen false alarm)");

// Live probe
const r = await probeProjectDiskSize();
console.log("LIVE:", r.status, "-", r.message);
console.log("DETAILS:", r.technicalDetails);
