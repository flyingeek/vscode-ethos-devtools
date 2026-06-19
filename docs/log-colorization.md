# Log Colorization

Ethos DevTools injects syntax highlighting rules into Ethos log files opened in VS Code.

## Requirements

The colorization relies on a grammar injection into the `text.log` scope. It tries to target only Ethos log files, but it may also colorize other log files that happen to match the same patterns. If you see unexpected colorization in a non-Ethos log file, please report it as an issue.

## Highlighted patterns

The following patterns are recognized in Ethos log files (format: `YYYY-MM-DD HH:MM:SS.mmm [level] clock …`):

| Pattern | Style |
| --- | --- |
| `[error]` lines | Bold red |
| Lines containing `lua` + `not found` | Bold red |
| Lines matching `SCRIPTS:/path:line` (Lua script errors) | Bold red |
| `[warn]` / `[warning]` lines | Bold orange |
| Lines containing `Ethos started!` / `Ethos stopped!` | Heading |
| Ethos log lines | Timestamp uses a different color than other log lines (lua log lines) |
| [error], [warn], [debug] | changed semantic marking for better theme support (see [Theme colors](#theme-colors) below) |

## Scope

The grammar is injected into `text.log` via `L:text.log` (the `L:` prefix means it only injects into the outermost scope, avoiding interference with other injections). It does not modify any other language or file type.

## Theme colors

The colorization will depends on your theme. If "error" or "warning' colors seem off, you can customize them in your settings.json file (user or workspace):

```json
    "editor.tokenColorCustomizations": {
        "textMateRules": [
            {
                "name": "log-error",
                "scope": "log.error",
                "settings": {
                    "foreground": "#ff0000",
                    "fontStyle": "bold"
                }
            },
            {
                "name": "log-warn",
                "scope": "log.warn",
                "settings": {
                    "foreground": "#ffaa00",
                    "fontStyle": "bold"
                }
            }
        ],
    }
```
