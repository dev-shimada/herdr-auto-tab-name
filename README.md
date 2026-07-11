# herdr-auto-tab-name

A [herdr](https://herdr.dev/) plugin that automatically sets each tab's label
to the directory name of its current working directory — no more renaming tabs
by hand.

Before: `1` · `2` · `3` — After: `api` · `frontend` · `infra`

## How it works

The plugin hooks herdr events (tab/pane created, focused, moved, closed, agent
status changes, workspace focus, worktree opened) and, on each event, walks
every workspace and relabels tabs through `herdr tab rename`.

A tab's directory is resolved from its focused pane (or first pane):
`foreground_cwd` — the cwd of the foreground process — when herdr can resolve
it, falling back to the pane's `cwd`. Your home directory is shown as `~`.

Manual renames are respected. A tab is only relabeled when its label is still
the herdr default (a bare number like `1`) or a label this plugin set earlier.
Rename a tab yourself and the plugin leaves it alone from then on; rename it
back to a number to hand it back to the plugin.

Because herdr emits no event when you simply `cd` inside a shell, a label can
lag until the next event (switching tabs or panes, agent status changes, and
so on). In practice labels catch up as soon as you interact with herdr. Use
the `sync` action to refresh immediately, or source the optional
[shell hook](#instant-updates-on-cd-optional) for instant updates.

## Requirements

- herdr `>= 0.7.0`
- [Node.js](https://nodejs.org/) 22.18 or newer on your `PATH`

The plugin is a single dependency-free TypeScript file that Node runs directly
via [type stripping](https://nodejs.org/api/typescript.html) — there is no
build step, and the code you review is exactly the code that runs. Node 24+
runs it silently; 22.18–23.5 prints a one-line experimental warning to the
plugin log, which is harmless.

## Install

```bash
herdr plugin install dev-shimada/herdr-auto-tab-name
```

Labels sync automatically from the next herdr event on. To force a sync:

```bash
herdr plugin action invoke dev-shimada.auto-tab-name.sync
```

Optionally bind the sync action to a key in your herdr config:

```toml
[[keys.command]]
key = "prefix+n"
type = "plugin_action"
command = "dev-shimada.auto-tab-name.sync"
description = "sync tab names"
```

## Instant updates on cd (optional)

For labels that update the moment you `cd`, source the bundled shell hook
inside herdr panes. It renames the pane's tab directly on every directory
change (bypassing the manual-rename protection for that tab, since your `cd`
is the intent). Find the plugin root with `herdr plugin list`, then add to
your shell rc:

```zsh
# ~/.zshrc
[[ -n "$HERDR_ENV" ]] && source /path/to/herdr-auto-tab-name/shell/hook.zsh
```

```bash
# ~/.bashrc
[[ -n "$HERDR_ENV" ]] && source /path/to/herdr-auto-tab-name/shell/hook.bash
```

The hook is a no-op outside herdr, so sourcing it unconditionally is also
fine. The event-driven plugin keeps covering panes that don't run your shell
(agents, one-off commands, other shells).

## Configuration

Configuration is optional. Create `config.json` in the plugin config
directory (`herdr plugin config-dir dev-shimada.auto-tab-name` prints the
path):

```json
{
  "overwrite_manual": false,
  "max_length": 0
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `overwrite_manual` | `false` | Relabel every tab, including tabs you renamed manually. |
| `max_length` | `0` | Truncate labels longer than this to `max_length` characters with a trailing `…`. `0` disables truncation. |

## Disable / uninstall

```bash
herdr plugin disable dev-shimada.auto-tab-name   # keep installed, stop hooks
herdr plugin uninstall dev-shimada.auto-tab-name
```

## Development

```bash
git clone https://github.com/dev-shimada/herdr-auto-tab-name
herdr plugin link ./herdr-auto-tab-name
herdr plugin action invoke dev-shimada.auto-tab-name.sync
herdr plugin log list --plugin dev-shimada.auto-tab-name
```

The logic lives in `sync.mts`. Type checking is dev-only tooling
(`package.json` / `tsconfig.json` play no part at install or run time):

```bash
npm install
npm run check        # tsc --noEmit with erasableSyntaxOnly
node tests/smoke.mjs # functional test against a stub herdr binary
```

### Releasing

One command, no manual version editing:

```bash
scripts/release.sh 0.2.0
```

The script bumps `version` in `herdr-plugin.toml` / `package.json` on the
tip of `main`, runs the checks, commits, tags `v0.2.0`, and pushes the
commit and tag together. The Release workflow then validates the tag
(on `main`, versions match), re-runs the check suite, and publishes a
GitHub release with generated notes. Requires push access to `main`
(the repository admin bypasses the branch ruleset; CI itself never
writes to `main`).

State lives in `HERDR_PLUGIN_STATE_DIR/labels.json` (the labels the plugin
set, used to tell its own labels apart from yours). Deleting it is safe; the
plugin re-adopts tabs whose labels are bare numbers.

## License

MIT
