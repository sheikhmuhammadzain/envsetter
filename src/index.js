"use strict"

const path = require("path")
const ora = require("ora")
const chalk = require("chalk")
const figures = require("figures")

const {scanCodebase, scanEnvFilesOnly, parseExistingEnv} = require("./scanner")
const {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  promptForValues,
  showSummary,
} = require("./ui")
const {writeEnvFile, ensureGitignore, syncToEnvExample} = require("./writer")

// Theme colors matching ui.js
const T = {
  primary: "#00D4FF",
  accent: "#A78BFA",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  muted: "#64748B",
  text: "#E2E8F0",
  textDim: "#94A3B8",
}

async function main() {
  const cwd = process.cwd()
  let envFilePath
  const isDeepScan = process.argv.includes("--deep")
  const hasUsableValue = (envMap, key) => {
    if (!envMap.has(key)) return false
    const value = envMap.get(key)
    return typeof value === "string" && value.trim().length > 0
  }

  showBanner()

  // ── Scanning Phase ──────────────────────────────────────────────────────────
  const scanLabel = isDeepScan
    ? "Deep scanning codebase for environment variables"
    : "Scanning env files for environment variables"

  const spinner = ora({
    text: chalk.hex(T.textDim)(scanLabel),
    spinner: "dots12",
    color: "cyan",
    prefixText: chalk.hex(T.accent)("  ◆"),
  }).start()

  let foundVars
  try {
    foundVars = isDeepScan ? scanCodebase(cwd) : scanEnvFilesOnly(cwd)
  } catch (err) {
    spinner.fail(chalk.hex(T.danger)("Failed to scan for environment variables"))
    console.error(err)
    process.exit(1)
  }

  spinner.succeed(chalk.hex(T.success)("Scan complete"))
  console.log("")

  // ── No Variables Found ──────────────────────────────────────────────────────
  if (foundVars.size === 0) {
    console.log(
      chalk.hex(T.warning)(
        `\n  ⚠ No environment variables found in your codebase.\n` +
          chalk.hex(T.muted)(`  Make sure you're in the right directory, or try:\n`) +
          chalk.hex(T.primary)(`  $ envsetter --deep\n`),
      ),
    )
    process.exit(0)
  }

  // ── Select Target File ─────────────────────────────────────────────────────
  envFilePath = await askEnvFile(cwd)
  const existingEnv = parseExistingEnv(path.resolve(cwd, envFilePath))
  console.log("")

  // ── Show Scan Summary ──────────────────────────────────────────────────────
  const {missing, alreadySet} = showScanResult(foundVars, existingEnv)
  const mode = await askMode(missing, alreadySet)

  if (mode === "exit") {
    console.log(chalk.hex(T.muted)("\n  Bye! 👋\n"))
    process.exit(0)
  }

  // ── Determine Variables to Fill ────────────────────────────────────────────
  let varsToFill
  if (mode === "missing") {
    varsToFill = [...foundVars.keys()].filter(k => !hasUsableValue(existingEnv, k))
  } else {
    varsToFill = [...foundVars.keys()]
  }

  if (varsToFill.length === 0) {
    console.log(
      chalk.hex(T.success)(
        `\n  ✔ All environment variables are already set!\n`,
      ),
    )
    process.exit(0)
  }

  // ── Interactive Fill ───────────────────────────────────────────────────────
  let savedCount = 0
  const newValues = await promptForValues(
    varsToFill,
    existingEnv,
    foundVars,
    async (key, value) => {
      const written = writeEnvFile(envFilePath, new Map([[key, value]]), existingEnv)
      savedCount += written
      existingEnv.set(key, value)
    },
  )

  if (newValues.size === 0) {
    showSummary(0, envFilePath)
    process.exit(0)
  }

  // ── Gitignore Check ────────────────────────────────────────────────────────
  const isIgnored = ensureGitignore(envFilePath)
  if (isIgnored === false) {
    console.log("")
    console.log(
      chalk.hex(T.warning)(
        `  ⚠ ${chalk.bold(envFilePath)} is ${chalk.bold("NOT")} in .gitignore!`,
      ),
    )
    console.log(
      chalk.hex(T.muted)(
        `    Run: ${chalk.hex(T.primary)(`echo "${path.basename(envFilePath)}" >> .gitignore`)}`,
      ),
    )
  }

  showSummary(savedCount, envFilePath)
}

module.exports = {main}
