"use strict"

const path = require("path")
const ora = require("ora")
const chalk = require("chalk")

const {scanCodebase, scanEnvFilesOnly, parseExistingEnv, discoverEnvFolders} = require("./scanner")
const {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  askFolder,
  promptForValues,
  askBulkPaste,
  showSummary,
} = require("./ui")
const {writeEnvFile, ensureGitignore, syncToEnvExample} = require("./writer")

// Theme colors matching ui.js
const T = {
  accent: "#3B82F6",
  cyan: "#22D3EE",
  green: "#10B981",
  yellow: "#F59E0B",
  red: "#EF4444",
  purple: "#A78BFA",
  text: "#F4F4F5",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  textSubtle: "#52525B",
}

/**
 * Process a single folder — scan, select env file, fill values
 */
async function processFolder(folderPath, isDeepScan, folderLabel) {
  const hasUsableValue = (envMap, key) => {
    if (!envMap.has(key)) return false
    const value = envMap.get(key)
    return typeof value === "string" && value.trim().length > 0
  }

  // Show which folder we're working on
  if (folderLabel) {
    console.log("")
    console.log(
      chalk.hex(T.accent)(`  › `) +
      chalk.bold.hex(T.text)(`Working in: `) +
      chalk.bold.hex(T.primary)(folderLabel),
    )
    console.log(chalk.hex(T.textSubtle)(`  ${"─".repeat(50)}`))
    console.log("")
  }

  // ── Scanning Phase ──────────────────────────────────────────────────────────
  const scanLabel = isDeepScan
    ? "Deep scanning for environment variables"
    : "Scanning env files for environment variables"

  const spinner = ora({
    text: chalk.hex(T.textSecondary)(scanLabel),
    spinner: "dots12",
    color: "cyan",
    prefixText: chalk.hex(T.accent)("  ›"),
  }).start()

  let foundVars
  try {
    foundVars = isDeepScan ? scanCodebase(folderPath) : scanEnvFilesOnly(folderPath)
  } catch (err) {
    spinner.fail(chalk.hex(T.red)("Failed to scan for environment variables"))
    console.error(err)
    return {saved: 0, skipped: true}
  }

  spinner.succeed(chalk.hex(T.green)("Scan complete"))
  console.log("")

  // ── No Variables Found ──────────────────────────────────────────────────────
  if (foundVars.size === 0) {
    console.log(
      chalk.hex(T.yellow)(
        `  ⚠ No environment variables found.\n` +
          chalk.hex(T.textMuted)(`  Try: envsetter --deep\n`),
      ),
    )
    return {saved: 0, skipped: true}
  }

  // ── Select Target File ─────────────────────────────────────────────────────
  const envFilePath = await askEnvFile(folderPath)
  const fullEnvPath = path.resolve(folderPath, envFilePath)
  const existingEnv = parseExistingEnv(fullEnvPath)
  console.log("")

  // ── Show Scan Summary ──────────────────────────────────────────────────────
  const {missing, alreadySet} = showScanResult(foundVars, existingEnv)
  const mode = await askMode(missing, alreadySet)

  if (mode === "exit") {
    console.log(chalk.hex(T.textMuted)("\n  Skipped this folder.\n"))
    return {saved: 0, skipped: true}
  }

  // ── Bulk Paste Mode ────────────────────────────────────────────────────────
  if (mode === "bulk") {
    const bulkVars = await askBulkPaste()
    if (!bulkVars || bulkVars.size === 0) {
      showSummary(0, envFilePath)
      return {saved: 0, skipped: false}
    }

    const savedCount = writeEnvFile(fullEnvPath, bulkVars, existingEnv)

    // Sync to .env.example
    const savedKeys = [...bulkVars.keys()]
    if (savedKeys.length > 0) {
      const synced = syncToEnvExample(savedKeys)
      if (synced > 0) {
        console.log(
          chalk.hex(T.green)(
            `  ✔ Synced ${synced} new ${synced > 1 ? "keys" : "key"} to .env.example`,
          ),
        )
      }
    }

    showSummary(savedCount, envFilePath)
    return {saved: savedCount, skipped: false}
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
      chalk.hex(T.green)(`\n  ✔ All environment variables are already set!\n`),
    )
    return {saved: 0, skipped: false}
  }

  // ── Interactive Fill ───────────────────────────────────────────────────────
  let savedCount = 0
  const newValues = await promptForValues(
    varsToFill,
    existingEnv,
    foundVars,
    async (key, value) => {
      const written = writeEnvFile(fullEnvPath, new Map([[key, value]]), existingEnv)
      savedCount += written
      existingEnv.set(key, value)
    },
  )

  if (newValues.size === 0) {
    showSummary(0, envFilePath)
    return {saved: 0, skipped: false}
  }

  // ── Gitignore Check ────────────────────────────────────────────────────────
  const isIgnored = ensureGitignore(envFilePath)
  if (isIgnored === false) {
    console.log("")
    console.log(
      chalk.hex(T.yellow)(
        `  ⚠ ${chalk.bold(envFilePath)} is ${chalk.bold("NOT")} in .gitignore!`,
      ),
    )
    console.log(
      chalk.hex(T.textMuted)(
        `    Run: ${chalk.hex(T.accent)(`echo "${path.basename(envFilePath)}" >> .gitignore`)}`,
      ),
    )
  }

  // ── Sync keys to .env.example ──────────────────────────────────────────────
  const savedKeys = [...newValues.keys()]
  if (savedKeys.length > 0) {
    const synced = syncToEnvExample(savedKeys)
    if (synced > 0) {
      console.log(
        chalk.hex(T.green)(
          `  ✔ Synced ${synced} new ${synced > 1 ? "keys" : "key"} to .env.example`,
        ),
      )
    }
  }

  showSummary(savedCount, envFilePath)
  return {saved: savedCount, skipped: false}
}

async function main() {
  const cwd = process.cwd()
  const isDeepScan = process.argv.includes("--deep")

  showBanner()

  // ── Discover Folders with Env Files ────────────────────────────────────────
  const discoverSpinner = ora({
    text: chalk.hex(T.textSecondary)("Discovering folders with env files..."),
    spinner: "dots12",
    color: "cyan",
    prefixText: chalk.hex(T.accent)("  ›"),
  }).start()

  const folders = discoverEnvFolders(cwd)

  if (folders.length === 0) {
    discoverSpinner.warn(chalk.hex(T.yellow)("No env files found in any folder"))
    console.log("")

    if (!isDeepScan) {
      console.log(
        chalk.hex(T.textMuted)(`  Try deep scanning to find env references in code:\n`) +
        chalk.hex(T.accent)(`  $ envsetter --deep\n`),
      )
    }

    // Fall back to running on cwd directly
    discoverSpinner.stop()
    await processFolder(cwd, isDeepScan, null)
    return
  }

  discoverSpinner.succeed(
    chalk.hex(T.green)(
      `Found env files in ${folders.length} folder${folders.length > 1 ? "s" : ""}`,
    ),
  )
  console.log("")

  // ── Folder Selection ───────────────────────────────────────────────────────
  const selected = await askFolder(folders)

  if (selected === "all") {
    // Process all folders sequentially
    let totalSaved = 0
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i]
      const folderLabel = `${folder.relPath === "." ? "./ (root)" : folder.relPath}  [${i + 1}/${folders.length}]`
      const result = await processFolder(folder.absPath, isDeepScan, folderLabel)
      totalSaved += result.saved
    }

    if (totalSaved > 0) {
      console.log("")
      console.log(
        chalk.hex(T.green)(
          `  ✔ Total: ${totalSaved} variable${totalSaved > 1 ? "s" : ""} saved across ${folders.length} folders`,
        ),
      )
      console.log("")
    }
  } else if (selected) {
    // Process single selected folder
    const folderLabel = selected.relPath === "." ? null : selected.relPath
    await processFolder(selected.absPath, isDeepScan, folderLabel)
  } else {
    // No folder selected (shouldn't happen)
    await processFolder(cwd, isDeepScan, null)
  }
}

module.exports = {main}
