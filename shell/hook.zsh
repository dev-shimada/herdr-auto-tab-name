# herdr-auto-tab-name: rename the herdr tab to $PWD's directory name on cd.
# Optional companion to the event-driven plugin — gives instant updates when
# you cd inside a shell. Source this file from ~/.zshrc (see README.md).

if [[ -n "$HERDR_ENV" && -n "$HERDR_TAB_ID" ]]; then
  _herdr_auto_tab_name() {
    local herdr_bin="${HERDR_BIN_PATH:-herdr}"
    local label="${PWD:t}"
    [[ "$PWD" == "$HOME" ]] && label="~"
    "$herdr_bin" tab rename "$HERDR_TAB_ID" "$label" >/dev/null 2>&1
  }
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd _herdr_auto_tab_name
  _herdr_auto_tab_name
fi
