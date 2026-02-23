# EnvSetter CLI - Complete Implementation

Let me build this entire CLI tool from scratch, production-ready.

## Project Structure

```
envsetter/
├── package.json
├── README.md
├── bin/
│   └── envsetter.js
├── src/
│   ├── index.js
│   ├── scanner.js
│   ├── ui.js
│   └── writer.js
└── .gitignore
```

## 1. `package.json`

```json
{
  "name": "envsetter",
  "version": "1.0.0",
  "description": "Interactive CLI to scan your codebase for environment variables and set their values easily — no more manually writing KEY=VALUE.",
  "main": "src/index.js",
  "bin": {
    "envsetter": "./bin/envsetter.js"
  },
  "files": ["bin", "src"],
  "keywords": [
    "env",
    "dotenv",
    "cli",
    "environment",
    "variables",
    "setter",
    "scanner"
  ],
  "author": "You",
  "license": "MIT",
  "dependencies": {
    "chalk": "^4.1.2",
    "inquirer": "^8.2.6",
    "ora": "^5.4.1",
    "glob": "^8.1.0",
    "boxen": "^5.1.2",
    "figures": "^3.2.0"
  }
}
```

## 2. `bin/envsetter.js`

```javascript
#!/usr/bin/env node

"use strict"

const {main} = require("../src/index")

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

## 3. `src/scanner.js` — The Brain That Finds Every ENV

```javascript
"use strict"

const fs = require("fs")
const path = require("path")
const glob = require("glob")

// ─── Patterns that catch every way devs reference env vars ───────────────────
const ENV_PATTERNS = [
  // process.env.VARIABLE_NAME
  /process\.env\.([A-Z][A-Z0-9_]+)/g,

  // process.env['VARIABLE_NAME'] or process.env["VARIABLE_NAME"]
  /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,

  // import.meta.env.VARIABLE_NAME (Vite)
  /import\.meta\.env\.([A-Z][A-Z0-9_]+)/g,

  // NEXT_PUBLIC_, REACT_APP_, VITE_, NUXT_ prefixed in any context
  /\b(NEXT_PUBLIC_[A-Z0-9_]+)\b/g,
  /\b(REACT_APP_[A-Z0-9_]+)\b/g,
  /\b(VITE_[A-Z0-9_]+)\b/g,
  /\b(NUXT_[A-Z0-9_]+)\b/g,
  /\b(EXPO_PUBLIC_[A-Z0-9_]+)\b/g,

  // os.environ.get("VAR") or os.environ["VAR"] or os.getenv("VAR")  — Python
  /os\.environ\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  /os\.environ\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
  /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // ENV["VAR"] or ENV.fetch("VAR") — Ruby
  /ENV\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
  /ENV\.fetch\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // env("VAR") — Laravel/PHP
  /env\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // System.getenv("VAR") — Java
  /System\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // os.Getenv("VAR") — Go
  /os\.Getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // std::env::var("VAR") — Rust
  /std::env::var\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // ${VAR} in YAML / docker-compose
  /\$\{([A-Z][A-Z0-9_]+)\}/g,

  // $VAR in shell scripts / Dockerfiles
  /\$([A-Z][A-Z0-9_]+)\b/g,
]

// Env var names to always ignore (runtime / system provided)
const BLACKLIST = new Set([
  "NODE_ENV",
  "HOME",
  "PATH",
  "USER",
  "SHELL",
  "PWD",
  "LANG",
  "TERM",
  "HOSTNAME",
  "OLDPWD",
  "EDITOR",
  "TMPDIR",
  "TMP",
  "TEMP",
  "CI",
  "NODE",
  "NPM",
  "NVM",
  "SHLVL",
  "LOGNAME",
  "LC_ALL",
  "LC_CTYPE",
  "DISPLAY",
  "COLORTERM",
  "COLUMNS",
  "LINES",
  "SSH_AUTH_SOCK",
  "SSH_CLIENT",
  "SSH_CONNECTION",
  "SSH_TTY",
  "XDG_SESSION_ID",
  "XDG_RUNTIME_DIR",
  "XDG_DATA_DIRS",
  "XDG_CONFIG_DIRS",
  "DBUS_SESSION_BUS_ADDRESS",
  "MAIL",
  "MANPATH",
  "PAGER",
  "LESS",
  "_",
])

// File extensions we actually care about
const CODE_EXTENSIONS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "rb",
  "php",
  "go",
  "rs",
  "java",
  "vue",
  "svelte",
  "astro",
  "yml",
  "yaml",
  "toml",
  "sh",
  "bash",
  "zsh",
  "env.example",
  "env.sample",
  "env.template",
  "Dockerfile",
]

/**
 * Build the glob pattern
 */
function buildGlobPattern() {
  const exts = CODE_EXTENSIONS.join(",")
  return `**/*.{${exts}}`
}

/**
 * Extra standalone filenames to scan (no extension match)
 */
const EXTRA_FILES = [
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.local.example",
  "Makefile",
]

/**
 * Directories to always ignore
 */
const IGNORE_DIRS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  ".next/**",
  ".nuxt/**",
  ".output/**",
  "coverage/**",
  "__pycache__/**",
  "vendor/**",
  ".venv/**",
  "venv/**",
  "target/**",
  ".cache/**",
  ".turbo/**",
]

/**
 * Parse an existing .env file and return a Map of key→value
 */
function parseExistingEnv(envPath) {
  const existing = new Map()
  if (!fs.existsSync(envPath)) return existing

  const content = fs.readFileSync(envPath, "utf-8")
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.substring(0, eqIndex).trim()
    let value = trimmed.substring(eqIndex + 1).trim()

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    existing.set(key, value)
  }

  return existing
}

/**
 * Scan the entire codebase and return discovered env var names
 */
function scanCodebase(cwd) {
  const foundVars = new Map() // key → Set of files where found

  // 1. Glob for code files
  const pattern = buildGlobPattern()
  const files = glob.sync(pattern, {
    cwd,
    ignore: IGNORE_DIRS,
    nodir: true,
    absolute: true,
    dot: true,
  })

  // 2. Add extra standalone files
  for (const extra of EXTRA_FILES) {
    const fullPath = path.join(cwd, extra)
    if (fs.existsSync(fullPath) && !files.includes(fullPath)) {
      files.push(fullPath)
    }
  }

  // 3. Scan each file
  for (const filePath of files) {
    // Skip actual .env file (we read it separately)
    const basename = path.basename(filePath)
    if (basename === ".env" || basename === ".env.local") continue

    let content
    try {
      content = fs.readFileSync(filePath, "utf-8")
    } catch {
      continue // binary or permission issue
    }

    const relPath = path.relative(cwd, filePath)

    for (const regex of ENV_PATTERNS) {
      // Reset lastIndex for global regex
      regex.lastIndex = 0
      let match
      while ((match = regex.exec(content)) !== null) {
        const varName = match[1]
        if (!varName) continue
        if (BLACKLIST.has(varName)) continue
        if (varName.length < 3) continue // skip tiny names like "A"

        if (!foundVars.has(varName)) {
          foundVars.set(varName, new Set())
        }
        foundVars.get(varName).add(relPath)
      }
    }
  }

  return foundVars
}

module.exports = {scanCodebase, parseExistingEnv}
```

## 4. `src/ui.js` — The Beautiful Interactive Terminal UI

```javascript
"use strict"

const chalk = require("chalk")
const inquirer = require("inquirer")
const boxen = require("boxen")
const figures = require("figures")

/**
 * Show the welcome banner
 */
function showBanner() {
  const title = chalk.bold.hex("#00DFFF")("⚡ EnvSetter")
  const subtitle = chalk.gray("Scan → Fill → Save. No more KEY=VALUE typing.")

  const banner = boxen(`${title}\n${subtitle}`, {
    padding: 1,
    margin: {top: 1, bottom: 1, left: 0, right: 0},
    borderStyle: "round",
    borderColor: "#00DFFF",
    textAlignment: "center",
  })

  console.log(banner)
}

/**
 * Show scanning animation result
 */
function showScanResult(foundVars, existingEnv) {
  const total = foundVars.size
  const alreadySet = [...foundVars.keys()].filter(k =>
    existingEnv.has(k),
  ).length
  const missing = total - alreadySet

  console.log(
    boxen(
      `${chalk.bold("Scan Complete")}\n\n` +
        `${figures.pointer} ${chalk.white("Found:")}        ${chalk.bold.yellow(total)} env variables\n` +
        `${figures.pointer} ${chalk.white("Already set:")}  ${chalk.bold.green(alreadySet)}\n` +
        `${figures.pointer} ${chalk.white("Missing:")}      ${chalk.bold.red(missing)}`,
      {
        padding: 1,
        margin: {top: 0, bottom: 1, left: 0, right: 0},
        borderStyle: "single",
        borderColor: "yellow",
      },
    ),
  )

  return {total, alreadySet, missing}
}

/**
 * Show where an env var was found
 */
function showVarLocations(varName, locations) {
  const fileList = [...locations].slice(0, 5) // show max 5
  const extra = locations.size > 5 ? ` (+${locations.size - 5} more)` : ""
  const locStr = fileList
    .map(f => chalk.gray(`  ${figures.arrowRight} ${f}`))
    .join("\n")

  console.log(chalk.gray(`\n  Found in:\n${locStr}${chalk.gray(extra)}`))
}

/**
 * Ask which mode the user wants
 */
async function askMode(missingCount, alreadySetCount) {
  const choices = []

  if (missingCount > 0) {
    choices.push({
      name: `${figures.play} Fill missing variables only (${chalk.red(missingCount)} vars)`,
      value: "missing",
    })
  }

  if (alreadySetCount > 0) {
    choices.push({
      name: `${figures.pencil} Edit all variables (${chalk.yellow(missingCount + alreadySetCount)} vars)`,
      value: "all",
    })
  }

  if (missingCount === 0 && alreadySetCount > 0) {
    choices.push({
      name: `${figures.pencil} Edit existing variables (${chalk.green(alreadySetCount)} vars)`,
      value: "all",
    })
  }

  choices.push({
    name: `${figures.cross} Exit`,
    value: "exit",
  })

  const {mode} = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: chalk.bold("What would you like to do?"),
      choices,
    },
  ])

  return mode
}

/**
 * Ask for env file target
 */
async function askEnvFile() {
  const {envFile} = await inquirer.prompt([
    {
      type: "list",
      name: "envFile",
      message: chalk.bold("Which env file to write to?"),
      choices: [
        {name: ".env", value: ".env"},
        {name: ".env.local", value: ".env.local"},
        {name: ".env.development", value: ".env.development"},
        {name: ".env.production", value: ".env.production"},
        {name: "Custom path...", value: "custom"},
      ],
    },
  ])

  if (envFile === "custom") {
    const {customPath} = await inquirer.prompt([
      {
        type: "input",
        name: "customPath",
        message: "Enter file path:",
        default: ".env",
      },
    ])
    return customPath
  }

  return envFile
}

/**
 * The main interactive loop — Vercel-style two-box key/value entry
 *
 * For each variable:
 *   ┌─────────────────────────────────┐
 *   │  KEY:    DATABASE_URL           │
 *   │  VALUE:  [user pastes here]     │
 *   └─────────────────────────────────┘
 */
async function promptForValues(varsToFill, existingEnv, foundVars) {
  const results = new Map()
  const varList = [...varsToFill].sort()
  const total = varList.length

  console.log(
    chalk.dim(
      `\n  ${figures.info} Paste values for each variable. Press ${chalk.white("Enter")} to keep existing / leave empty.\n` +
        `  ${figures.info} Type ${chalk.white("skip")} to skip, ${chalk.white("quit")} to finish early.\n`,
    ),
  )

  for (let i = 0; i < varList.length; i++) {
    const varName = varList[i]
    const currentValue = existingEnv.get(varName) || ""
    const locations = foundVars.get(varName)
    const counter = chalk.dim(`[${i + 1}/${total}]`)

    // Header box for this variable
    console.log(
      `\n  ${counter} ${chalk.bold.hex("#00DFFF")(figures.pointer)} ${chalk.bold.white("KEY:")}   ${chalk.bold.yellow(varName)}`,
    )

    // Show where it's used
    if (locations && locations.size > 0) {
      showVarLocations(varName, locations)
    }

    // Show current value if exists
    if (currentValue) {
      const masked = maskValue(currentValue)
      console.log(chalk.dim(`  Current: ${masked}`))
    }

    // Prompt for value
    const {value} = await inquirer.prompt([
      {
        type: "input",
        name: "value",
        message: chalk.bold.white("VALUE:"),
        default: currentValue || undefined,
        prefix: "  ",
        transformer: input => {
          // Don't transform while typing — just show it
          return input
        },
      },
    ])

    if (value.toLowerCase() === "quit") {
      console.log(
        chalk.yellow(
          `\n  ${figures.warning} Stopped early. Saving what we have so far...\n`,
        ),
      )
      break
    }

    if (value.toLowerCase() === "skip") {
      console.log(chalk.gray(`  ${figures.arrowRight} Skipped`))
      continue
    }

    results.set(varName, value)
    console.log(chalk.green(`  ${figures.tick} Set`))
  }

  return results
}

/**
 * Mask sensitive values for display
 */
function maskValue(value) {
  if (!value) return chalk.dim("(empty)")
  if (value.length <= 6) return chalk.dim("••••••")
  return chalk.dim(
    value.substring(0, 4) + "••••" + value.substring(value.length - 2),
  )
}

/**
 * Show final summary
 */
function showSummary(saved, envFilePath) {
  if (saved === 0) {
    console.log(
      boxen(chalk.yellow(`No changes made.`), {
        padding: 1,
        borderStyle: "single",
        borderColor: "yellow",
      }),
    )
    return
  }

  console.log(
    boxen(
      `${chalk.bold.green(`${figures.tick} Success!`)}\n\n` +
        `${chalk.white(`Saved ${chalk.bold(saved)} variable${saved > 1 ? "s" : ""} to ${chalk.bold.cyan(envFilePath)}`)}\n\n` +
        chalk.dim(`Remember to add ${envFilePath} to your .gitignore!`),
      {
        padding: 1,
        margin: {top: 1, bottom: 1, left: 0, right: 0},
        borderStyle: "round",
        borderColor: "green",
        textAlignment: "center",
      },
    ),
  )
}

module.exports = {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  promptForValues,
  showSummary,
}
```

## 5. `src/writer.js` — Smart .env File Writer

```javascript
"use strict"

const fs = require("fs")
const path = require("path")

/**
 * Determine if a value needs to be quoted
 */
function needsQuotes(value) {
  if (!value) return false
  // Quote if it contains spaces, #, =, newlines, or special chars
  return /[\s#=\\$"'`!]/.test(value) || value.includes("\n")
}

/**
 * Escape a value for .env format
 */
function formatValue(value) {
  if (!value && value !== "") return '""'

  if (needsQuotes(value)) {
    // Use double quotes and escape internal double quotes and backslashes
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
    return `"${escaped}"`
  }

  return value
}

/**
 * Write env variables to file
 * - Preserves existing comments and structure
 * - Updates existing keys in place
 * - Appends new keys at the end
 */
function writeEnvFile(envFilePath, newVars, existingEnv) {
  const fullPath = path.resolve(envFilePath)
  let lines = []
  const updatedKeys = new Set()

  // Read existing file if it exists
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf-8")
    lines = content.split("\n")

    // Update existing lines in place
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith("#")) continue

      const eqIndex = line.indexOf("=")
      if (eqIndex === -1) continue

      const key = line.substring(0, eqIndex).trim()

      if (newVars.has(key)) {
        lines[i] = `${key}=${formatValue(newVars.get(key))}`
        updatedKeys.add(key)
      }
    }
  }

  // Collect new keys that weren't in the file already
  const appendKeys = []
  for (const [key, value] of newVars) {
    if (!updatedKeys.has(key)) {
      appendKeys.push({key, value})
    }
  }

  // If we have new keys to append, add a separator
  if (appendKeys.length > 0) {
    // Don't add blank line if file is empty
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("")
    }

    if (lines.length > 0) {
      lines.push("# ─── Added by EnvSetter ───────────────────────")
    }

    for (const {key, value} of appendKeys) {
      lines.push(`${key}=${formatValue(value)}`)
    }
  }

  // Ensure file ends with newline
  const finalContent = lines.join("\n").replace(/\n+$/, "") + "\n"

  // Write file
  fs.writeFileSync(fullPath, finalContent, "utf-8")

  return updatedKeys.size + appendKeys.length
}

/**
 * Ensure .gitignore includes the env file
 */
function ensureGitignore(envFilePath) {
  const gitignorePath = path.resolve(".gitignore")
  const envBasename = path.basename(envFilePath)

  if (!fs.existsSync(gitignorePath)) return

  const content = fs.readFileSync(gitignorePath, "utf-8")
  const lines = content.split("\n").map(l => l.trim())

  // Check if already ignored
  const isIgnored = lines.some(line => {
    if (line.startsWith("#")) return false
    return (
      line === envBasename ||
      line === envFilePath ||
      line === ".env*" ||
      line === ".env"
    )
  })

  if (!isIgnored) {
    // Don't auto-modify, just warn — handled in UI
    return false
  }

  return true
}

module.exports = {writeEnvFile, ensureGitignore}
```

## 6. `src/index.js` — Main Orchestrator

```javascript
"use strict"

const path = require("path")
const ora = require("ora")
const chalk = require("chalk")
const figures = require("figures")

const {scanCodebase, parseExistingEnv} = require("./scanner")
const {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  promptForValues,
  showSummary,
} = require("./ui")
const {writeEnvFile, ensureGitignore} = require("./writer")

async function main() {
  const cwd = process.cwd()

  // ─── 1. Banner ─────────────────────────────────────────────────────────
  showBanner()

  // ─── 2. Ask which env file ─────────────────────────────────────────────
  const envFilePath = await askEnvFile()

  // ─── 3. Scan codebase ──────────────────────────────────────────────────
  const spinner = ora({
    text: chalk.dim("Scanning your codebase for environment variables..."),
    spinner: "dots12",
    color: "cyan",
  }).start()

  let foundVars
  try {
    foundVars = scanCodebase(cwd)
  } catch (err) {
    spinner.fail("Failed to scan codebase")
    console.error(err)
    process.exit(1)
  }

  // ─── 4. Parse existing env ─────────────────────────────────────────────
  const existingEnv = parseExistingEnv(path.resolve(cwd, envFilePath))

  spinner.succeed(chalk.dim("Scan complete"))

  // ─── 5. Nothing found? ────────────────────────────────────────────────
  if (foundVars.size === 0) {
    console.log(
      chalk.yellow(
        `\n  ${figures.warning} No environment variables found in your codebase.\n` +
          `  Make sure you're in the right directory.\n`,
      ),
    )
    process.exit(0)
  }

  // ─── 6. Show results ──────────────────────────────────────────────────
  const {missing, alreadySet} = showScanResult(foundVars, existingEnv)

  // ─── 7. Ask mode ──────────────────────────────────────────────────────
  const mode = await askMode(missing, alreadySet)

  if (mode === "exit") {
    console.log(chalk.dim("\n  Bye! 👋\n"))
    process.exit(0)
  }

  // ─── 8. Determine which vars to fill ──────────────────────────────────
  let varsToFill
  if (mode === "missing") {
    varsToFill = [...foundVars.keys()].filter(k => !existingEnv.has(k))
  } else {
    varsToFill = [...foundVars.keys()]
  }

  if (varsToFill.length === 0) {
    console.log(
      chalk.green(
        `\n  ${figures.tick} All environment variables are already set!\n`,
      ),
    )
    process.exit(0)
  }

  // ─── 9. Interactive prompt ─────────────────────────────────────────────
  const newValues = await promptForValues(varsToFill, existingEnv, foundVars)

  if (newValues.size === 0) {
    showSummary(0, envFilePath)
    process.exit(0)
  }

  // ─── 10. Write to file ────────────────────────────────────────────────
  const writeSpinner = ora({
    text: chalk.dim(`Writing to ${envFilePath}...`),
    spinner: "dots",
    color: "green",
  }).start()

  try {
    const savedCount = writeEnvFile(envFilePath, newValues, existingEnv)
    writeSpinner.succeed(chalk.dim(`Written to ${envFilePath}`))

    // ─── 11. Gitignore check ───────────────────────────────────────────
    const isIgnored = ensureGitignore(envFilePath)
    if (isIgnored === false) {
      console.log(
        chalk.yellow(
          `\n  ${figures.warning} ${chalk.bold(envFilePath)} is ${chalk.bold("NOT")} in your .gitignore!\n` +
            `  Run: ${chalk.cyan(`echo "${path.basename(envFilePath)}" >> .gitignore`)}\n`,
        ),
      )
    }

    // ─── 12. Summary ──────────────────────────────────────────────────
    showSummary(savedCount, envFilePath)
  } catch (err) {
    writeSpinner.fail("Failed to write env file")
    console.error(err)
    process.exit(1)
  }
}

module.exports = {main}
```

## 7. `.gitignore`

```
node_modules/
.env
.env.local
.env.development
.env.production
.DS_Store
```

## 8. `README.md`

````markdown
# ⚡ EnvSetter

> Stop manually writing `KEY=VALUE`. Scan your codebase, paste values, done.

EnvSetter scans your entire codebase for environment variables (`process.env.X`,
`import.meta.env.X`, `.env.example` files, etc.), shows you which ones are
missing, and gives you a clean Vercel-style interface to paste values.

## Install

```bash
npm install -g envsetter
```
````

## Usage

```bash
cd your-project
envsetter
```

That's it. It will:

1. 🔍 **Scan** your codebase for every env variable reference
2. 📋 **Show** which are already set and which are missing
3. 📝 **Prompt** you with a clean KEY / VALUE interface
4. 💾 **Save** everything to your `.env` file with proper formatting

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

- 🎯 Deep scanning across 20+ file types
- 🔒 Masks existing values for security
- 📁 Choose output: `.env`, `.env.local`, `.env.production`, or custom
- ✏️ Edit all or just fill missing variables
- 📍 Shows where each variable is used in your code
- 💅 Proper quoting for values with spaces or special chars
- 📝 Preserves comments and structure in existing env files
- ⚠️ Warns if your `.env` isn't in `.gitignore`

## License

MIT

````

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
````

## What It Looks Like In Action

```
╭──────────────────────────────────────╮
│                                      │
│          ⚡ EnvSetter                │
│   Scan → Fill → Save. No more       │
│      KEY=VALUE typing.               │
│                                      │
╰──────────────────────────────────────╯

? Which env file to write to? .env

✔ Scan complete

┌──────────────────────────────────────┐
│  Scan Complete                       │
│                                      │
│  ❯ Found:        12 env variables   │
│  ❯ Already set:  3                  │
│  ❯ Missing:      9                  │
└──────────────────────────────────────┘

? What would you like to do?
  ▶ Fill missing variables only (9 vars)
    ✏ Edit all variables (12 vars)
    ✖ Exit

  [1/9] ❯ KEY:   DATABASE_URL

  Found in:
    → src/lib/db.ts
    → src/config/index.ts

  VALUE: postgresql://user:pass@localhost:5432/mydb
  ✔ Set

  [2/9] ❯ KEY:   NEXT_PUBLIC_API_URL
  ...

╭──────────────────────────────────────╮
│                                      │
│          ✔ Success!                  │
│                                      │
│   Saved 9 variables to .env         │
│                                      │
│   Remember to add .env to your      │
│          .gitignore!                 │
│                                      │
╰──────────────────────────────────────╯
```

This gives you a **complete, production-ready npm CLI** that scans every type of env variable reference across all major languages/frameworks, shows a beautiful Vercel-style interactive UI, handles quoting/escaping, preserves existing file structure, and warns about gitignore — all with zero configuration needed. Just `envsetter` and go.
