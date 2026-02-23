# âš¡ EnvSetter

> Stop manually writing `KEY=VALUE`. Scan your codebase, paste values, done.

EnvSetter scans your entire codebase for environment variables (`process.env.X`,
`import.meta.env.X`, `.env.example` files, etc.), shows you which ones are
missing, and gives you a clean Vercel-style interface to paste values.

## Install

```bash
npm install -g envsetter
```

## Usage

```bash
cd your-project
envsetter
```

That's it. It will:

1. ðŸ” **Scan** your codebase for every env variable reference
2. ðŸ“‹ **Show** which are already set and which are missing
3. ðŸ“ **Prompt** you with a clean KEY / VALUE interface
4. ðŸ’¾ **Save** everything to your `.env` file with proper formatting

## What it detects

| Pattern                 | Language/Framework |
| ----------------------- | ------------------ |
| `process.env.VAR`       | Node.js            |
| `process.env['VAR']`    | Node.js            |
| `import.meta.env.VAR`   | Vite               |
| `NEXT_PUBLIC_*`         | Next.js            |
| `REACT_APP_*`           | Create React App   |
| `VITE_*`                | Vite               |
| `NUXT_*`                | Nuxt               |
| `EXPO_PUBLIC_*`         | Expo               |
| `os.environ.get('VAR')` | Python             |
| `ENV["VAR"]`            | Ruby               |
| `env('VAR')`            | Laravel            |
| `System.getenv("VAR")`  | Java               |
| `os.Getenv("VAR")`      | Go                 |
| `std::env::var("VAR")`  | Rust               |
| `${VAR}`                | Docker/YAML        |
| `.env.example` entries  | Any                |

## Features

- ðŸŽ¯ Deep scanning across 20+ file types
- ðŸ”’ Masks existing values for security
- ðŸ“ Choose output: `.env`, `.env.local`, `.env.production`, or custom
- âœï¸ Edit all or just fill missing variables
- ðŸ“ Shows where each variable is used in your code
- ðŸ’… Proper quoting for values with spaces or special chars
- ðŸ“ Preserves comments and structure in existing env files
- âš ï¸ Warns if your `.env` isn't in `.gitignore`

## License

MIT

## How to Build & Publish

```bash
# 1. Create the project
mkdir envsetter && cd envsetter

# 2. Create all files as shown above

# 3. Install dependencies
npm install

# 4. Make the bin executable
chmod +x bin/envsetter.js

# 5. Test locally
npm link
cd /some/project
envsetter

# 6. Publish to npm
npm login
npm publish
```

## What It Looks Like In Action

```
â•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
â”‚                                      â”‚
â”‚          âš¡ EnvSetter                â”‚
â”‚   Scan â†’ Fill â†’ Save. No more       â”‚
â”‚      KEY=VALUE typing.               â”‚
â”‚                                      â”‚
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯

? Which env file to write to? .env

âœ” Scan complete

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Scan Complete                       â”‚
â”‚                                      â”‚
â”‚  â¯ Found:        12 env variables   â”‚
â”‚  â¯ Already set:  3                  â”‚
â”‚  â¯ Missing:      9                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

? What would you like to do?
  â–¶ Fill missing variables only (9 vars)
    âœ Edit all variables (12 vars)
    âœ– Exit

  [1/9] â¯ KEY:   DATABASE_URL

  Found in:
    â†’ src/lib/db.ts
    â†’ src/config/index.ts

  VALUE: postgresql://user:pass@localhost:5432/mydb
  âœ” Set

  [2/9] â¯ KEY:   NEXT_PUBLIC_API_URL
  ...

â•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
â”‚                                      â”‚
â”‚          âœ” Success!                  â”‚
â”‚                                      â”‚
â”‚   Saved 9 variables to .env         â”‚
â”‚                                      â”‚
â”‚   Remember to add .env to your      â”‚
â”‚          .gitignore!                 â”‚
â”‚                                      â”‚
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯
```

This gives you a **complete, production-ready npm CLI** that scans every type of env variable reference across all major languages/frameworks, shows a beautiful Vercel-style interactive UI, handles quoting/escaping, preserves existing file structure, and warns about gitignore â€” all with zero configuration needed. Just `envsetter` and go.
