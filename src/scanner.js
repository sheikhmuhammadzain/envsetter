"use strict"

const fs = require("fs")
const path = require("path")
const glob = require("glob")

// â”€â”€â”€ Patterns that catch every way devs reference env vars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // os.environ.get("VAR") or os.environ["VAR"] or os.getenv("VAR")  â€” Python
  /os\.environ\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  /os\.environ\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
  /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // ENV["VAR"] or ENV.fetch("VAR") â€” Ruby
  /ENV\[['"]([A-Z][A-Z0-9_]+)['"]\]/g,
  /ENV\.fetch\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // env("VAR") â€” Laravel/PHP
  /env\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // System.getenv("VAR") â€” Java
  /System\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // os.Getenv("VAR") â€” Go
  /os\.Getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,

  // std::env::var("VAR") â€” Rust
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

const ENV_SOURCE_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.local.example",
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
 * Files to skip when scanning EnvSetter's own source repo.
 * This prevents false positives from documentation/examples in this tool itself.
 */
const SELF_IGNORE_FILES = new Set([
  "bin/envsetter.js",
  "src/index.js",
  "src/scanner.js",
  "src/ui.js",
  "src/writer.js",
  "plan.md",
])

function isSelfEnvsetterProject(cwd) {
  const pkgPath = path.join(cwd, "package.json")
  if (!fs.existsSync(pkgPath)) return false

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    return pkg && pkg.name === "envsetter"
  } catch {
    return false
  }
}

/**
 * Parse an existing .env file and return a Map of keyâ†’value
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

function extractEnvKeysFromContent(content) {
  const keys = new Set()
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.substring(0, eqIndex).trim()
    if (!key) continue
    if (!/^[A-Z][A-Z0-9_]+$/.test(key)) continue
    if (BLACKLIST.has(key)) continue

    keys.add(key)
  }

  return keys
}

function scanEnvFilesOnly(cwd) {
  const foundVars = new Map()

  for (const file of ENV_SOURCE_FILES) {
    const fullPath = path.join(cwd, file)
    if (!fs.existsSync(fullPath)) continue

    let content
    try {
      content = fs.readFileSync(fullPath, "utf-8")
    } catch {
      continue
    }

    const keys = extractEnvKeysFromContent(content)
    for (const key of keys) {
      if (!foundVars.has(key)) {
        foundVars.set(key, new Set())
      }
      foundVars.get(key).add(file)
    }
  }

  return foundVars
}

/**
 * Scan the entire codebase and return discovered env var names
 */
function scanCodebase(cwd) {
  const foundVars = new Map() // key â†’ Set of files where found
  const skipSelfFiles = isSelfEnvsetterProject(cwd)

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
    const relPath = path.relative(cwd, filePath).replace(/\\/g, "/")

    if (skipSelfFiles && SELF_IGNORE_FILES.has(relPath)) {
      continue
    }

    // Skip actual .env file (we read it separately)
    const basename = path.basename(filePath)
    if (basename === ".env" || basename === ".env.local") continue

    let content
    try {
      content = fs.readFileSync(filePath, "utf-8")
    } catch {
      continue // binary or permission issue
    }

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

/**
 * Recursively discover all folders that contain env files.
 * Returns array of { relPath, absPath, envFiles[] }
 */
function discoverEnvFolders(cwd) {
  const ENV_NAMES = [
    ".env", ".env.local", ".env.development", ".env.production",
    ".env.example", ".env.sample", ".env.template",
  ]

  const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next", ".nuxt",
    ".output", "coverage", "__pycache__", "vendor", ".venv",
    "venv", "target", ".cache", ".turbo",
  ])

  const results = []

  function walk(dir, depth) {
    if (depth > 8) return // prevent too-deep traversal

    // Check if this directory has any env files
    const foundEnvFiles = []
    for (const name of ENV_NAMES) {
      const full = path.join(dir, name)
      if (fs.existsSync(full)) {
        foundEnvFiles.push(name)
      }
    }

    if (foundEnvFiles.length > 0) {
      const relPath = path.relative(cwd, dir).replace(/\\/g, "/") || "."
      results.push({
        relPath,
        absPath: dir,
        envFiles: foundEnvFiles,
      })
    }

    // Recurse into subdirectories
    let entries
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true})
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith(".") && entry.name !== ".") continue
      walk(path.join(dir, entry.name), depth + 1)
    }
  }

  walk(cwd, 0)
  return results
}

module.exports = {scanCodebase, scanEnvFilesOnly, parseExistingEnv, discoverEnvFolders}
