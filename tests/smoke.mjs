// Functional smoke test: runs sync.mts against the stub herdr binary and
// asserts the rename decisions and state file. Usage: node tests/smoke.mjs
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "auto-tab-name-test-"));
const stateDir = path.join(tmp, "state");
const configDir = path.join(tmp, "config");
fs.mkdirSync(stateDir);
fs.mkdirSync(configDir);

// t3's current label was set by the plugin earlier; t2's was not.
fs.writeFileSync(path.join(stateDir, "labels.json"), JSON.stringify({ t3: "oldname" }));

const renameLog = path.join(tmp, "renames.log");
fs.writeFileSync(renameLog, "");

const res = spawnSync(process.execPath, [path.join(root, "sync.mts")], {
  encoding: "utf8",
  env: {
    ...process.env,
    HERDR_BIN_PATH: path.join(root, "tests", "stub", "herdr"),
    HERDR_PLUGIN_STATE_DIR: stateDir,
    HERDR_PLUGIN_CONFIG_DIR: configDir,
    STUB_RENAME_LOG: renameLog,
  },
});

assert.equal(res.status, 0, `sync.mts failed:\n${res.stderr}`);

const renames = fs.readFileSync(renameLog, "utf8").trim().split("\n").sort();
assert.deepEqual(
  renames,
  ["t1 alpha", "t3 gamma"],
  `unexpected renames: ${JSON.stringify(renames)} (t2 has a manual label and must not be touched)`,
);

const state = JSON.parse(fs.readFileSync(path.join(stateDir, "labels.json"), "utf8"));
assert.deepEqual(state, { t1: "alpha", t3: "gamma" });

fs.rmSync(tmp, { recursive: true, force: true });
console.log("smoke test OK");
