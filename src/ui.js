"use strict"

const chalk = require("chalk")
const inquirer = require("inquirer")
const boxen = require("boxen")
const figures = require("figures")
const fs = require("fs")
const path = require("path")

// ─── Design System ──────────────────────────────────────────────────────────────
const THEME = {
  primary: "#00D4FF",
  primaryDim: "#0097B2",
  accent: "#A78BFA",
  accentDim: "#7C5CBF",
  success: "#34D399",
  successDim: "#059669",
  warning: "#FBBF24",
  warningDim: "#D97706",
  danger: "#F87171",
  dangerDim: "#DC2626",
  text: "#E2E8F0",
  textDim: "#94A3B8",
  muted: "#64748B",
  subtle: "#475569",
}

const BOX = {
  h: "─", v: "│",
  dot: "●", diamond: "◆",
  arrow: "▸", arrowRight: "→",
  check: "✔", cross: "✖", warn: "⚠",
}

// ─── Utility Helpers ────────────────────────────────────────────────────────────

function c(hex, text) { return chalk.hex(hex)(text) }
function cBold(hex, text) { return chalk.bold.hex(hex)(text) }
function dim(text) { return chalk.hex(THEME.muted)(text) }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

function pad(str, width) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "")
  return str + " ".repeat(Math.max(0, width - visible.length))
}

function centerText(text, width) {
  const visible = text.replace(/\x1b\[[0-9;]*m/g, "")
  const totalPad = Math.max(0, width - visible.length)
  const leftPad = Math.floor(totalPad / 2)
  return " ".repeat(leftPad) + text + " ".repeat(totalPad - leftPad)
}

// ─── Visual Components ──────────────────────────────────────────────────────────

function progressBar(done, total, width = 28) {
  if (total <= 0) return dim("░".repeat(width))
  const ratio = clamp(done / total, 0, 1)
  const filled = Math.round(ratio * width)
  const empty = width - filled
  return c(THEME.primary, "█".repeat(Math.ceil(filled / 2))) +
    c(THEME.accent, "█".repeat(Math.floor(filled / 2))) +
    chalk.hex(THEME.subtle)("░".repeat(empty))
}

function badge(text, color) {
  return chalk.bgHex(color).hex("#0F172A").bold(` ${text} `)
}

function statusDot(color) { return chalk.hex(color)(BOX.dot) }
function label(text) { return chalk.hex(THEME.textDim)(text) }

function sectionHeader(title, icon = BOX.diamond) {
  return `  ${c(THEME.accent, icon)} ${cBold(THEME.text, title)} ${c(THEME.subtle, BOX.h.repeat(Math.max(2, 42 - title.length)))}`
}

// ─── Smart Value Hints ──────────────────────────────────────────────────────────
// Detect expected value type from key name and provide helpful hints + defaults

const VALUE_HINTS = [
  {test: /^(DATABASE_URL|DB_URL|POSTGRES_URL)$/i, type: "URL", hint: "Database connection string"},
  {test: /^(MONGO_URI|MONGODB_URI)$/i, type: "URL", hint: "MongoDB connection string"},
  {test: /^(REDIS_URL|REDIS_URI)$/i, type: "URL", hint: "Redis connection string"},
  {test: /^(NEXT_PUBLIC_|REACT_APP_|VITE_)?(API_URL|BASE_URL|APP_URL|SITE_URL|SERVER_URL|BACKEND_URL)$/i, type: "URL", hint: "HTTP endpoint"},
  {test: /(SUPABASE_URL)$/i, type: "URL", hint: "Supabase project URL"},
  {test: /PORT$/i, type: "Number", hint: "Port number"},
  {test: /(SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY|ANON_KEY|SERVICE_ROLE_KEY)$/i, type: "Secret", hint: "Sensitive — hidden input"},
  {test: /PASSWORD|PASS$/i, type: "Secret", hint: "Password — hidden input"},
  {test: /(SMTP_HOST|MAIL_HOST|EMAIL_HOST)$/i, type: "Host", hint: "Mail server hostname"},
  {test: /(SMTP_PORT|MAIL_PORT)$/i, type: "Number", hint: "Mail port"},
  {test: /(SMTP_USER|MAIL_USER|EMAIL_USER|MAIL_FROM)$/i, type: "Email", hint: "Email address"},
  {test: /(S3_BUCKET|AWS_BUCKET|BUCKET_NAME)$/i, type: "String", hint: "Bucket name"},
  {test: /(AWS_REGION|REGION)$/i, type: "Region", hint: "Cloud region"},
  {test: /(DEBUG|VERBOSE|LOG_LEVEL)$/i, type: "Flag", hint: "true / false"},
  {test: /(NEXT_PUBLIC_)/, type: "Public", hint: "Exposed to browser"},
  {test: /(REACT_APP_)/, type: "Public", hint: "Exposed to browser"},
  {test: /(VITE_)/, type: "Public", hint: "Exposed to browser"},
]

function getValueHint(keyName) {
  for (const rule of VALUE_HINTS) {
    if (rule.test.test(keyName)) {
      return rule
    }
  }
  return null
}

// ─── Category Detection ─────────────────────────────────────────────────────────
// Group variables by prefix for visual grouping

function getCategory(varName) {
  if (/^DATABASE|^DB_|^MONGO|^POSTGRES|^MYSQL|^REDIS|^SUPABASE/.test(varName)) return "Database"
  if (/^NEXT_PUBLIC_/.test(varName)) return "Next.js (Public)"
  if (/^REACT_APP_/.test(varName)) return "React (Public)"
  if (/^VITE_/.test(varName)) return "Vite (Public)"
  if (/^AWS_|^S3_/.test(varName)) return "AWS"
  if (/^SMTP_|^MAIL_|^EMAIL_/.test(varName)) return "Email"
  if (/^STRIPE_/.test(varName)) return "Stripe"
  if (/^FIREBASE_/.test(varName)) return "Firebase"
  if (/^AUTH_|^JWT_|^SESSION_/.test(varName)) return "Auth"
  if (/^SENTRY_/.test(varName)) return "Sentry"
  return null
}

// ─── Inline Help Bar ────────────────────────────────────────────────────────────
// Compact, always-visible hint line showing available commands

function inlineHelp() {
  const cmds = [
    `${cBold(THEME.primary, "skip")}`,
    `${cBold(THEME.primary, "back")}`,
    `${cBold(THEME.warning, "clear")}`,
    `${cBold(THEME.accent, "list")}`,
    `${cBold(THEME.danger, "exit")}`,
    `${cBold(THEME.textDim, "skipall")}`,
  ]
  return `  ${dim("Cmds:")} ${cmds.join(dim(" · "))}  ${dim("| Enter = keep value | ? = help")}`
}

// ─── Full Command Panel ─────────────────────────────────────────────────────────

function commandPanel() {
  const lines = [
    "",
    sectionHeader("Commands", "?"),
    "",
    `    ${pad(cBold(THEME.primary, "skip"), 16)}  ${dim("Skip this variable")}`,
    `    ${pad(cBold(THEME.primary, "back"), 16)}  ${dim("Go to previous variable")}`,
    `    ${pad(cBold(THEME.warning, "clear"), 16)}  ${dim("Set value to empty string")}`,
    `    ${pad(cBold(THEME.accent, "list"), 16)}  ${dim("Show all remaining variables")}`,
    `    ${pad(cBold(THEME.textDim, "skipall"), 16)}  ${dim("Skip all remaining variables")}`,
    `    ${pad(cBold(THEME.danger, "exit"), 16)}  ${dim("Stop and keep all saved values")}`,
    "",
    `    ${dim("Press")} ${cBold(THEME.text, "Enter")} ${dim("without typing to keep the current value")}`,
    `    ${dim("Type")} ${cBold(THEME.text, "?")} ${dim("at any time to see this panel")}`,
    "",
  ]
  return lines.join("\n")
}

// ─── Banner ─────────────────────────────────────────────────────────────────────

function showBanner() {
  const art = [
    " _____ _   ___     __",
    "| ____| \\ | \\ \\   / /",
    "|  _| |  \\| |\\ \\ / / ",
    "| |___| |\\  | \\ V /  ",
    "|_____|_| \\_|  \\_/   ",
  ]

  const gradientColors = [THEME.primary, THEME.primary, THEME.accent, THEME.accent, THEME.accentDim]
  const coloredArt = art.map((line, i) => cBold(gradientColors[i], line))

  const inner = [
    "",
    ...coloredArt,
    "",
    `  ${c(THEME.primaryDim, "---")} ${cBold(THEME.primary, "S E T T E R")} ${c(THEME.primaryDim, "---")}`,
    "",
    `  ${dim("Scan")} ${c(THEME.subtle, ">")} ${dim("Fill")} ${c(THEME.subtle, ">")} ${dim("Save")}  ${c(THEME.subtle, "|")}  ${dim("Interactive .env manager")}`,
    `  ${dim("v1.0.0")}`,
    "",
  ].join("\n")

  console.log(
    boxen(inner, {
      padding: {top: 0, bottom: 0, left: 2, right: 2},
      margin: {top: 1, bottom: 1, left: 1, right: 0},
      borderStyle: "round",
      borderColor: THEME.primaryDim,
      textAlignment: "left",
    }),
  )
}

// ─── Scan Result Summary ────────────────────────────────────────────────────────

function showScanResult(foundVars, existingEnv) {
  const hasUsableValue = key => {
    if (!existingEnv.has(key)) return false
    const value = existingEnv.get(key)
    return typeof value === "string" && value.trim().length > 0
  }

  const total = foundVars.size
  const alreadySet = [...foundVars.keys()].filter(hasUsableValue).length
  const missing = total - alreadySet
  const pct = total > 0 ? Math.round((alreadySet / total) * 100) : 0
  const pctColor = pct >= 80 ? THEME.success : pct >= 50 ? THEME.warning : THEME.danger

  const lines = [
    sectionHeader("Scan Results"),
    "",
    `    ${statusDot(THEME.warning)}  ${label("Variables found")}   ${cBold(THEME.text, total.toString().padStart(4))}`,
    `    ${statusDot(THEME.success)}  ${label("Already set")}      ${cBold(THEME.success, alreadySet.toString().padStart(4))}`,
    `    ${statusDot(THEME.danger)}  ${label("Missing")}          ${cBold(THEME.danger, missing.toString().padStart(4))}`,
    "",
    `    ${label("Coverage")}  ${progressBar(alreadySet, total)}  ${cBold(pctColor, pct + "%")}`,
    "",
  ]

  console.log(boxen(lines.join("\n"), {
    padding: {top: 0, bottom: 0, left: 0, right: 1},
    margin: {top: 0, bottom: 1, left: 1, right: 0},
    borderStyle: "round",
    borderColor: THEME.primaryDim,
  }))

  return {total, alreadySet, missing}
}

// ─── Mode Selector ──────────────────────────────────────────────────────────────

async function askMode(missingCount, alreadySetCount) {
  console.log(sectionHeader("Choose Action", BOX.arrow))
  console.log("")

  const choices = []

  if (missingCount > 0) {
    choices.push({
      name: `${c(THEME.primary, BOX.arrow)} Fill missing only  ${badge(missingCount.toString(), THEME.primaryDim)}`,
      value: "missing",
    })
  }

  if (alreadySetCount > 0) {
    const editLabel = missingCount > 0 ? "Edit all variables" : "Edit existing"
    const editCount = missingCount > 0 ? missingCount + alreadySetCount : alreadySetCount
    choices.push({
      name: `${c(THEME.accent, "✎")} ${editLabel}  ${badge(editCount.toString(), THEME.accentDim)}`,
      value: "all",
    })
  }

  // Always offer bulk paste
  choices.push({
    name: `${c(THEME.success, "⬆")} Bulk paste  ${dim("(paste whole .env content)")}`,
    value: "bulk",
  })

  choices.push({
    name: `${c(THEME.danger, BOX.cross)} Exit`,
    value: "exit",
  })

  const {mode} = await inquirer.prompt([{
    type: "list",
    name: "mode",
    message: cBold(THEME.textDim, "Select mode"),
    choices,
    pageSize: 8,
    prefix: c(THEME.accent, "  ?"),
  }])

  return mode
}

// ─── Env File Selector ──────────────────────────────────────────────────────────

const WRITABLE_ENV_FILES = [".env", ".env.local", ".env.development", ".env.production"]

async function askEnvFile(cwd) {
  console.log(sectionHeader("Target File", ">>"))
  console.log("")

  // Dynamically find ALL .env* files that exist in this directory
  let allFiles = []
  try {
    allFiles = fs.readdirSync(cwd).filter(f => {
      if (!f.startsWith(".env")) return false
      // Must be a file, not a directory
      try { return fs.statSync(path.join(cwd, f)).isFile() } catch { return false }
    }).sort()
  } catch {
    // If we can't read the dir, fall back to empty
  }

  const choices = []

  // Show ALL existing env files — clearly marked "exists"
  if (allFiles.length > 0) {
    allFiles.forEach(f => {
      const isExample = f.includes("example") || f.includes("sample") || f.includes("template")
      const tag = isExample
        ? c(THEME.success, "template · exists")
        : c(THEME.success, "exists")
      choices.push({
        name: `${c(THEME.success, BOX.check)} ${cBold(THEME.text, f)}  ${dim("(")}${tag}${dim(")")}`,
        value: f,
      })
    })
  }

  // Show standard files that don't exist yet — clearly marked "new"
  const missingStandard = WRITABLE_ENV_FILES.filter(f => !allFiles.includes(f))
  if (missingStandard.length > 0) {
    if (choices.length > 0) {
      choices.push(new inquirer.Separator(dim("  ─── create new ───")))
    }
    missingStandard.forEach(f => {
      choices.push({
        name: `${c(THEME.muted, "+")} ${c(THEME.textDim, f)}  ${dim("(new)")}`,
        value: f,
      })
    })
  }

  choices.push({name: `${c(THEME.accent, "…")} Custom path`, value: "custom"})

  const {envFile} = await inquirer.prompt([{
    type: "list",
    name: "envFile",
    message: cBold(THEME.textDim, "Write to"),
    choices,
    pageSize: 12,
    prefix: c(THEME.accent, "  ?"),
  }])

  if (envFile === "custom") {
    const {customPath} = await inquirer.prompt([{
      type: "input",
      name: "customPath",
      message: cBold(THEME.textDim, "Enter path"),
      default: ".env",
      prefix: c(THEME.accent, "  ?"),
      validate: input => {
        if (!input || !input.trim()) return chalk.hex(THEME.danger)("Path cannot be empty")
        return true
      },
    }])
    return customPath.trim()
  }

  return envFile
}

// ─── Interactive Prompt Loop ────────────────────────────────────────────────────

async function promptForValues(varsToFill, existingEnv, foundVars, onSetValue) {
  const results = new Map()
  const varList = [...varsToFill].sort()
  const total = varList.length
  let exitRequested = false
  let skippedCount = 0
  let lastCategory = null

  // Show full commands panel once at start
  console.log(commandPanel())

  for (let i = 0; i < varList.length; i++) {
    const varName = varList[i]
    const currentValue = existingEnv.get(varName) || ""
    const locations = foundVars.get(varName)
    const secretLike = isSensitiveKey(varName)
    const stepNum = i + 1
    const hint = getValueHint(varName)

    // ─── Category Header (group visual separator) ─────────
    const category = getCategory(varName)
    if (category && category !== lastCategory) {
      console.log("")
      console.log(`  ${badge(category, THEME.accentDim)}`)
      lastCategory = category
    }

    // ─── Variable Card ────────────────────────────────────
    const pct = Math.round((i / total) * 100)

    // Build a clean card for this variable
    const cardLines = []
    cardLines.push(`${c(THEME.primary, BOX.diamond)} ${cBold(THEME.text, varName)}  ${dim(`[${stepNum}/${total}]`)}  ${dim(pct + "%")}`)
    cardLines.push(`${progressBar(i, total, 30)}`)

    // Type + source on one line
    if (hint) {
      const typeColor = hint.type === "Secret" ? THEME.warning : THEME.accent
      cardLines.push(`${c(typeColor, hint.type)} ${dim(hint.hint)}`)
    }
    if (locations && locations.size > 0) {
      const files = [...locations].slice(0, 3)
      const extra = locations.size > 3 ? dim(` +${locations.size - 3}`) : ""
      cardLines.push(`${dim("Found in:")} ${files.map(f => c(THEME.textDim, f)).join(dim(", "))}${extra}`)
    }

    // Current value
    if (currentValue) {
      cardLines.push(`${statusDot(THEME.success)} ${dim("Current:")} ${dim(maskValue(currentValue))}`)
    } else {
      cardLines.push(`${statusDot(THEME.warning)} ${dim("Not set")}`)
    }

    console.log("")
    console.log(boxen(cardLines.join("\n"), {
      padding: {top: 0, bottom: 0, left: 1, right: 1},
      margin: {top: 0, bottom: 0, left: 1, right: 0},
      borderStyle: "round",
      borderColor: THEME.subtle,
    }))

    // ─── Value Input ────────────────────────────────────
    while (true) {
      const promptIcon = secretLike
        ? c(THEME.warning, "  🔒")
        : c(THEME.primary, "  " + BOX.arrow)

      const {value} = await inquirer.prompt([{
        type: secretLike ? "password" : "input",
        mask: secretLike ? "•" : undefined,
        name: "value",
        message: cBold(THEME.text, secretLike ? "Secret" : "Value"),
        default: currentValue || undefined,
        prefix: promptIcon,
      }])

      const trimmed = value.trim()
      const cmd = trimmed.toLowerCase()

      // ─── Command: exit ──────────────────────────────────
      if (cmd === "quit" || cmd === "exit") {
        const {confirmExit} = await inquirer.prompt([{
          type: "confirm",
          name: "confirmExit",
          message: dim("End session? All saved values are kept."),
          default: true,
          prefix: c(THEME.warning, "  " + BOX.warn),
        }])
        if (confirmExit) {
          console.log(c(THEME.warning, `\n  ${BOX.warn} Session ended early.\n`))
          exitRequested = true
          break
        }
        continue
      }

      // ─── Command: help ──────────────────────────────────
      if (cmd === "help" || cmd === "?") {
        console.log(commandPanel())
        continue
      }

      // ─── Command: list ──────────────────────────────────
      if (cmd === "list") {
        const remaining = varList.slice(i + 1)
        if (remaining.length === 0) {
          console.log(dim("    This is the last variable."))
        } else {
          console.log(dim(`    Remaining (${remaining.length}):`))
          remaining.forEach((v, idx) => {
            const cat = getCategory(v)
            const catLabel = cat ? c(THEME.accentDim, ` [${cat}]`) : ""
            const num = dim(`${(idx + 1).toString().padStart(2)}.`)
            console.log(`      ${num} ${c(THEME.textDim, v)}${catLabel}`)
          })
        }
        console.log("")
        continue
      }

      // ─── Command: back ──────────────────────────────────
      if (cmd === "back") {
        if (i === 0) {
          console.log(dim(`    ${BOX.arrowRight} Already at first variable`))
          continue
        }
        i -= 2
        lastCategory = null // reset category header
        console.log(dim(`    ${BOX.arrowRight} Going back...`))
        break
      }

      // ─── Command: skip ──────────────────────────────────
      if (cmd === "skip") {
        skippedCount += 1
        console.log(`  ${c(THEME.textDim, BOX.arrowRight)} ${dim("Skipped")}`)
        break
      }

      // ─── Command: skipall ─────────────────────────────────
      if (cmd === "skipall") {
        const remaining = total - (i + 1)
        const {confirmSkip} = await inquirer.prompt([{
          type: "confirm",
          name: "confirmSkip",
          message: dim(`Skip all ${remaining + 1} remaining variable${remaining > 0 ? "s" : ""}?`),
          default: false,
          prefix: c(THEME.warning, "  " + BOX.warn),
        }])
        if (confirmSkip) {
          skippedCount += remaining + 1
          console.log(dim(`    ${BOX.arrowRight} Skipped ${remaining + 1} variables`))
          exitRequested = true
          break
        }
        continue
      }

      // ─── Save Value ─────────────────────────────────────
      const finalValue = cmd === "clear" ? "" : value

      if (typeof onSetValue === "function") {
        await onSetValue(varName, finalValue)
      }

      results.set(varName, finalValue)
      const unchanged = currentValue === finalValue
      const icon = unchanged ? c(THEME.textDim, BOX.check) : c(THEME.success, BOX.check)
      const saveText = unchanged ? c(THEME.textDim, "Unchanged") : c(THEME.success, "Saved")
      const remaining = total - (i + 1)
      const stats = dim(`${results.size} done · ${skippedCount} skipped · ${remaining} left`)

      console.log(`  ${icon} ${saveText}  ${dim(BOX.v)}  ${stats}`)
      break
    }

    if (exitRequested) break
  }

  return results
}

// ─── Masking ────────────────────────────────────────────────────────────────────

function maskValue(value) {
  if (!value) return dim("(empty)")
  if (value.length <= 6) return dim("••••••")
  return dim(value.substring(0, 3) + "••••" + value.substring(value.length - 2))
}

function isSensitiveKey(key) {
  return /(SECRET|TOKEN|PASSWORD|PASS|KEY|PRIVATE|AUTH|CREDENTIAL)/i.test(key)
}

// ─── Final Summary ──────────────────────────────────────────────────────────────

function showSummary(saved, envFilePath) {
  console.log("")

  if (saved === 0) {
    const content = [
      "",
      centerText(c(THEME.warning, BOX.warn) + "  " + cBold(THEME.warning, "No changes made"), 48),
      "",
      centerText(dim("All variables were skipped or already set."), 48),
      "",
    ].join("\n")

    console.log(boxen(content, {
      padding: {top: 0, bottom: 0, left: 1, right: 1},
      margin: {top: 0, bottom: 1, left: 1, right: 0},
      borderStyle: "round",
      borderColor: THEME.warningDim,
    }))
    return
  }

  const content = [
    "",
    centerText(c(THEME.success, BOX.check) + "  " + cBold(THEME.success, "Complete"), 48),
    "",
    `  ${label("Saved")}     ${cBold(THEME.text, saved.toString())} ${dim(saved > 1 ? "variables" : "variable")}`,
    `  ${label("Target")}    ${cBold(THEME.primary, envFilePath)}`,
    "",
    centerText(dim(`Tip: make sure ${envFilePath} is in .gitignore`), 48),
    "",
  ].join("\n")

  console.log(boxen(content, {
    padding: {top: 0, bottom: 0, left: 1, right: 1},
    margin: {top: 0, bottom: 1, left: 1, right: 0},
    borderStyle: "round",
    borderColor: THEME.success,
  }))
}

// ─── Folder Picker ──────────────────────────────────────────────────────────────

function askFolder(folders) {
  // If only root folder, auto-select
  if (folders.length <= 1) {
    return Promise.resolve(folders[0] || null)
  }

  console.log(sectionHeader("Project Folders", ">>"))
  console.log("")
  console.log(dim("  Multiple folders with env files detected:"))
  console.log("")

  const choices = folders.map(folder => {
    const isRoot = folder.relPath === "."
    const folderName = isRoot ? "./ (root)" : folder.relPath
    const fileCount = folder.envFiles.length
    const fileList = folder.envFiles
      .map(f => c(THEME.textDim, f))
      .join(dim(", "))

    return {
      name: `${c(THEME.primary, BOX.arrow)} ${cBold(THEME.text, folderName)}  ${dim(`(${fileCount} file${fileCount > 1 ? "s" : ""}:`)} ${fileList}${dim(")")}`,
      value: folder,
      short: folderName,
    }
  })

  // Add an "all folders" option
  choices.push(new inquirer.Separator(dim("  ─────────────────────")))
  choices.push({
    name: `${c(THEME.accent, "+")} ${c(THEME.accent, "Edit all folders")} ${dim(`(${folders.length} total)`)}`,
    value: "all",
    short: "All folders",
  })

  return inquirer.prompt([{
    type: "list",
    name: "folder",
    message: cBold(THEME.textDim, "Select folder"),
    choices,
    pageSize: 15,
    prefix: c(THEME.accent, "  ?"),
  }]).then(a => a.folder)
}

// ─── Bulk Paste ─────────────────────────────────────────────────────────────────

/**
 * Parse raw bulk env text into a clean Map of key→value.
 * Handles messy input: extra spaces, missing quotes, duplicates, comments.
 */
function parseBulkInput(raw) {
  const result = new Map()
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue

    // Find the first = sign
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.substring(0, eqIndex).trim()
    let value = trimmed.substring(eqIndex + 1).trim()

    // Skip invalid keys
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Remove inline comments (but not inside quoted values)
    const commentIdx = value.indexOf(" #")
    if (commentIdx > -1) {
      value = value.substring(0, commentIdx).trim()
    }

    result.set(key, value)
  }
  return result
}

async function askBulkPaste() {
  const readline = require("readline")

  console.log("")
  console.log(sectionHeader("Bulk Paste", "+"))
  console.log("")
  console.log(dim("  Paste your env content below and press Enter."))
  console.log(dim("  Trailing empty lines are automatically ignored."))
  console.log("")

  // Collect lines using readline — works reliably on Windows
  // Multi-line paste sends all lines within milliseconds
  // We auto-finish after 500ms of no new lines
  const collectedLines = []

  const content = await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: c(THEME.primary, "  " + BOX.arrow + " "),
    })

    let timer = null
    const DEBOUNCE_MS = 500

    const finish = () => {
      if (timer) clearTimeout(timer)
      rl.close()
      resolve(collectedLines.join("\n"))
    }

    rl.prompt()

    rl.on("line", (line) => {
      // Empty line after we have data = finish
      if (line.trim() === "" && collectedLines.length > 0) {
        finish()
        return
      }

      // Skip leading empty lines
      if (line.trim() === "" && collectedLines.length === 0) {
        rl.prompt()
        return
      }

      collectedLines.push(line)

      // Show live count
      const varCount = parseBulkInput(collectedLines.join("\n")).size
      console.log(dim(`     ${BOX.check} ${varCount} var${varCount !== 1 ? "s" : ""} detected`))

      // Auto-finish after debounce (catches multi-line paste)
      if (timer) clearTimeout(timer)
      timer = setTimeout(finish, DEBOUNCE_MS)

      rl.prompt()
    })

    rl.on("close", () => {
      if (timer) clearTimeout(timer)
      resolve(collectedLines.join("\n"))
    })
  })

  if (!content || !content.trim()) {
    console.log(dim("  No content pasted. Skipping."))
    return null
  }

  const parsed = parseBulkInput(content)

  if (parsed.size === 0) {
    console.log(c(THEME.warning, `\n  ${BOX.warn} No valid KEY=VALUE pairs found.`))
    console.log(dim("  Expected format: KEY=value or KEY=\"value\""))
    console.log("")
    return null
  }

  // Show what was parsed
  const keys = [...parsed.keys()]
  const secretKeys = keys.filter(k => isSensitiveKey(k))
  const publicKeys = keys.filter(k => !isSensitiveKey(k))

  console.log("")
  console.log(sectionHeader(`Found ${keys.length} variable${keys.length > 1 ? "s" : ""}`, BOX.check))
  console.log("")

  publicKeys.forEach(k => {
    const val = parsed.get(k)
    const displayVal = val ? c(THEME.textDim, val.length > 40 ? val.substring(0, 37) + "..." : val) : dim("(empty)")
    console.log(`    ${c(THEME.success, BOX.check)} ${c(THEME.text, k)} ${dim("=")} ${displayVal}`)
  })
  secretKeys.forEach(k => {
    console.log(`    ${c(THEME.success, BOX.check)} ${c(THEME.text, k)} ${dim("=")} ${dim(maskValue(parsed.get(k)))}  ${dim("[secret]")}`)
  })
  console.log("")

  // Confirm before writing
  const {confirm} = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: cBold(THEME.text, `Write ${keys.length} variable${keys.length > 1 ? "s" : ""} to env file?`),
    default: true,
    prefix: c(THEME.accent, "  ?"),
  }])

  if (!confirm) {
    console.log(dim("  Cancelled. Nothing was written."))
    return null
  }

  return parsed
}

module.exports = {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  askFolder,
  promptForValues,
  askBulkPaste,
  showSummary,
}
