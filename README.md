# envsetter

> Stop manually writing `KEY=VALUE`. Scan your codebase, fill values interactively, done.

envsetter scans your entire project for environment variables — across `process.env`, `import.meta.env`, `.env.example`, and 15+ other patterns — then gives you a clean interactive interface to set them all in one go.

## Install

```bash
npm install -g envsetter
```

## Usage

```bash
cd your-project
envsetter
```

That's it. envsetter will:

1. **Scan** your codebase for every env variable reference
2. **Show** which are already set and which are missing
3. **Prompt** you interactively for each value
4. **Save** everything to your `.env` file with proper formatting and quoting

For deep scanning (finds vars referenced in source code, not just `.env` files):

```bash
envsetter --deep
```

## What it detects

| Pattern                    | Language / Framework |
| -------------------------- | -------------------- |
| `process.env.VAR`          | Node.js              |
| `process.env['VAR']`       | Node.js              |
| `import.meta.env.VAR`      | Vite                 |
| `NEXT_PUBLIC_*`            | Next.js              |
| `REACT_APP_*`              | Create React App     |
| `VITE_*`                   | Vite                 |
| `NUXT_*`                   | Nuxt                 |
| `EXPO_PUBLIC_*`            | Expo                 |
| `os.environ.get('VAR')`    | Python               |
| `ENV["VAR"]`               | Ruby                 |
| `env('VAR')`               | Laravel / PHP        |
| `System.getenv("VAR")`     | Java                 |
| `os.Getenv("VAR")`         | Go                   |
| `std::env::var("VAR")`     | Rust                 |
| `${VAR}` / `$VAR`          | Docker / YAML / Shell|
| `.env.example` entries     | Any                  |

## Features

- Scans 24+ file types across 15+ languages and frameworks
- Smart type hints (URL, Secret, Number, Email, etc.) per variable
- Masks sensitive values in the terminal — nothing leaks
- Supports `.env`, `.env.local`, `.env.production`, or any custom path
- Bulk paste mode — paste an entire `.env` block and confirm
- Shows exactly which files each variable is used in
- Properly quotes values with spaces or special characters
- Preserves comments and structure in existing `.env` files
- Syncs keys to `.env.example` automatically
- Warns if your `.env` is not in `.gitignore`
- Works with monorepos — detects multiple project folders
- Interactive commands: `skip`, `back`, `clear`, `list`, `skipall`, `exit`

## Interactive commands

While filling variables you can type:

| Command   | Action                          |
| --------- | ------------------------------- |
| `skip`    | Skip this variable              |
| `back`    | Go to previous variable         |
| `clear`   | Set value to empty string       |
| `list`    | Show all remaining variables    |
| `skipall` | Skip all remaining variables    |
| `exit`    | End session (saves what's done) |
| `?`       | Show command reference          |
| Enter     | Keep the current value          |

## License

MIT — Created by [Zain Afzal](https://zainafzal.dev)
