#!/usr/bin/env node
// Auto Tab Name: set each tab's label to the directory name of its current
// working directory. Runs as a herdr plugin event hook / action; requires no
// dependencies beyond Node itself.
//
// A tab's "current directory" is resolved from the tab's focused pane when
// herdr reports one, otherwise its first pane: `foreground_cwd` (the cwd of
// the foreground process) when available, falling back to the pane `cwd`.
//
// Manual renames are respected: a tab is only relabeled when its label is
// still the herdr default (a bare number) or a label this plugin set earlier
// (tracked in HERDR_PLUGIN_STATE_DIR/labels.json). Set `overwrite_manual`
// to true in HERDR_PLUGIN_CONFIG_DIR/config.json to relabel every tab.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERDR = process.env.HERDR_BIN_PATH || "herdr";
const DEFAULT_LABEL = /^[0-9]+$/;

function call(args) {
  const res = spawnSync(HERDR, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || "").trim();
    throw new Error(`herdr ${args.join(" ")} exited ${res.status}: ${detail}`);
  }
  const parsed = JSON.parse(res.stdout);
  return parsed && typeof parsed === "object" && "result" in parsed
    ? parsed.result
    : parsed;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function loadConfig() {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  const config = dir ? readJson(path.join(dir, "config.json"), {}) : {};
  return {
    overwriteManual: config.overwrite_manual === true,
    maxLength: Number.isInteger(config.max_length) ? config.max_length : 0,
  };
}

function labelForCwd(cwd, maxLength) {
  if (!cwd) {
    return null;
  }
  if (cwd === os.homedir()) {
    return "~";
  }
  // basename is empty for filesystem roots like "/" — keep the path itself.
  let label = path.basename(cwd) || cwd;
  if (maxLength > 0 && label.length > maxLength) {
    label = `${label.slice(0, maxLength - 1)}…`;
  }
  return label;
}

function cwdForTab(tabId, panes) {
  const tabPanes = panes.filter((pane) => pane.tab_id === tabId);
  if (tabPanes.length === 0) {
    return null;
  }
  const pane = tabPanes.find((p) => p.focused) ?? tabPanes[0];
  return pane.foreground_cwd || pane.cwd || null;
}

function main() {
  const config = loadConfig();
  const stateDir = process.env.HERDR_PLUGIN_STATE_DIR;
  const stateFile = stateDir ? path.join(stateDir, "labels.json") : null;
  // Labels this plugin set earlier, keyed by tab id. A tab whose current
  // label differs from this record was renamed by the user and is skipped.
  const ownedLabels = stateFile ? readJson(stateFile, {}) : {};
  const nextOwnedLabels = {};

  const workspaces = call(["workspace", "list"]).workspaces ?? [];
  for (const workspace of workspaces) {
    const wsArgs = ["--workspace", workspace.workspace_id];
    const tabs = call(["tab", "list", ...wsArgs]).tabs ?? [];
    const panes = call(["pane", "list", ...wsArgs]).panes ?? [];

    for (const tab of tabs) {
      const owned =
        DEFAULT_LABEL.test(tab.label) || ownedLabels[tab.tab_id] === tab.label;
      if (!owned && !config.overwriteManual) {
        continue;
      }
      const label = labelForCwd(cwdForTab(tab.tab_id, panes), config.maxLength);
      if (!label) {
        // Keep ownership so the tab is picked up again once its cwd resolves.
        if (ownedLabels[tab.tab_id] === tab.label) {
          nextOwnedLabels[tab.tab_id] = tab.label;
        }
        continue;
      }
      if (label !== tab.label) {
        call(["tab", "rename", tab.tab_id, label]);
      }
      nextOwnedLabels[tab.tab_id] = label;
    }
  }

  if (stateFile) {
    writeJsonAtomic(stateFile, nextOwnedLabels);
  }
}

try {
  main();
} catch (error) {
  console.error(`auto-tab-name: ${error.message ?? error}`);
  process.exit(1);
}
