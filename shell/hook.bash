# herdr-auto-tab-name: rename the herdr tab to $PWD's directory name on cd.
# Optional companion to the event-driven plugin — gives instant updates when
# you cd inside a shell. Source this file from ~/.bashrc (see README.md).

if [[ -n "$HERDR_ENV" && -n "$HERDR_TAB_ID" ]]; then
  _herdr_auto_tab_name() {
    if [[ "$PWD" != "$_herdr_last_pwd" ]]; then
      _herdr_last_pwd="$PWD"
      local herdr_bin="${HERDR_BIN_PATH:-herdr}"
      local label
      label="$(basename "$PWD")"
      [[ "$PWD" == "$HOME" ]] && label="~"
      "$herdr_bin" tab rename "$HERDR_TAB_ID" "$label" >/dev/null 2>&1
    fi
  }
  case ";$PROMPT_COMMAND;" in
    *";_herdr_auto_tab_name;"*) ;;
    *) PROMPT_COMMAND="_herdr_auto_tab_name${PROMPT_COMMAND:+;$PROMPT_COMMAND}" ;;
  esac
  _herdr_auto_tab_name
fi
