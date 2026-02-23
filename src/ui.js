"use strict"

const chalk = require("chalk")
const inquirer = require("inquirer")
const boxen = require("boxen")
const figures = require("figures")
const fs = require("fs")
const path = require("path")

// ─── Design System ──────────────────────────────────────────────────────────────
// Inspired by Vercel / OpenAI CLI aesthetics — clean, minimal, professional
const THEME = {
  // Core palette
  brand: "#FFFFFF",
  brandDim: "#A1A1AA",
  accent: "#3B82F6",     // Blue
  accentDim: "#1D4ED8",
  cyan: "#22D3EE",
  cyanDim: "#0891B2",
  green: "#10B981",
  greenDim: "#059669",
  yellow: "#F59E0B",
  yellowDim: "#D97706",
  red: "#EF4444",
  redDim: "#DC2626",
  purple: "#A78BFA",
  purpleDim: "#7C3AED",
  // Text hierarchy
  text: "#F4F4F5",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  textSubtle: "#52525B",
  // Borders
  border: "#3F3F46",
  borderDim: "#27272A",
}

// Unicode elements — geometric, clean
const SYM = {
  bar: "│",
  dash: "─",
  dot: "●",
  ring: "○",
  tri: "▲",
  triRight: "▶",
  triSmall: "›",
  check: "✓",
  cross: "✕",
  warn: "⚠",
  diamond: "◆",
  arrow: "→",
  bullet: "•",
  ellipsis: "…",
  block: "█",
  blockLight: "░",
  blockMed: "▒",
}

// ─── Utility Helpers ────────────────────────────────────────────────────────────

function c(hex, text) { return chalk.hex(hex)(text) }
function cb(hex, text) { return chalk.bold.hex(hex)(text) }
function dim(text) { return chalk.hex(THEME.textMuted)(text) }
function subtle(text) { return chalk.hex(THEME.textSubtle)(text) }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

function visLen(str) { return str.replace(/\x1b\[[0-9;]*m/g, "").length }

function pad(str, width) {
  return str + " ".repeat(Math.max(0, width - visLen(str)))
}

// ─── Visual Components ──────────────────────────────────────────────────────────

function progressBar(done, total, width = 24) {
  if (total <= 0) return subtle(SYM.blockLight.repeat(width))
  const ratio = clamp(done / total, 0, 1)
  const filled = Math.round(ratio * width)
  const empty = width - filled
  return c(THEME.accent, SYM.block.repeat(filled)) +
    chalk.hex(THEME.borderDim)(SYM.blockLight.repeat(empty))
}

function statusDot(color) { return chalk.hex(color)(SYM.dot) }

function sectionLine(title, width = 48) {
  const dashCount = Math.max(2, width - visLen(title) - 3)
  return `  ${cb(THEME.text, title)} ${subtle(SYM.dash.repeat(dashCount))}`
}

// ─── Smart Value Hints ──────────────────────────────────────────────────────────

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
    if (rule.test.test(keyName)) return rule
  }
  return null
}

// ─── Category Detection ─────────────────────────────────────────────────────────

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

// ─── Inline Help ────────────────────────────────────────────────────────────────

function inlineHelp() {
  const cmds = [
    cb(THEME.textSecondary, "skip"),
    cb(THEME.textSecondary, "back"),
    cb(THEME.yellow, "clear"),
    cb(THEME.textSecondary, "list"),
    cb(THEME.red, "exit"),
  ]
  return `  ${subtle("Commands:")} ${cmds.join(subtle(" · "))}  ${subtle("Enter = keep  ? = help")}`
}

// ─── Full Command Panel ─────────────────────────────────────────────────────────

function commandPanel() {
  const w = 20
  const lines = [
    "",
    `  ${cb(THEME.text, "Commands")}`,
    `  ${subtle(SYM.dash.repeat(40))}`,
    "",
    `    ${pad(cb(THEME.accent, "skip"), w)}${dim("Skip this variable")}`,
    `    ${pad(cb(THEME.accent, "back"), w)}${dim("Go to previous variable")}`,
    `    ${pad(cb(THEME.yellow, "clear"), w)}${dim("Set value to empty string")}`,
    `    ${pad(cb(THEME.textSecondary, "list"), w)}${dim("Show remaining variables")}`,
    `    ${pad(cb(THEME.textSecondary, "skipall"), w)}${dim("Skip all remaining")}`,
    `    ${pad(cb(THEME.red, "exit"), w)}${dim("End session")}`,
    "",
    `    ${dim("Press")} ${cb(THEME.text, "Enter")} ${dim("without typing to keep current value")}`,
    `    ${dim("Type")} ${cb(THEME.text, "?")} ${dim("to show this panel")}`,
    "",
  ]
  return lines.join("\n")
}

// ─── Banner ─────────────────────────────────────────────────────────────────────

function showBanner() {
  const version = "1.0.0"

  const logo = [
    "  ███████╗███╗   ██╗██╗   ██╗",
    "  ██╔════╝████╗  ██║██║   ██║",
    "  █████╗  ██╔██╗ ██║██║   ██║",
    "  ██╔══╝  ██║╚██╗██║╚██╗ ██╔╝",
    "  ███████╗██║ ╚████║ ╚████╔╝ ",
    "  ╚══════╝╚═╝  ╚═══╝  ╚═══╝  ",
  ]

  // Gradient from cyan to blue to purple
  const gradColors = ["#22D3EE", "#06B6D4", "#3B82F6", "#6366F1", "#8B5CF6", "#A78BFA"]
  const coloredLogo = logo.map((l, i) => cb(gradColors[i], l))

  console.log("")
  coloredLogo.forEach(l => console.log(l))
  console.log("")
  console.log(`  ${cb(THEME.text, "setter")} ${subtle("v" + version)}`)
  console.log(`  ${dim("Interactive environment variable manager")}`)
  console.log("")
  console.log(`  ${subtle(SYM.dash.repeat(44))}`)
  console.log(`  ${dim("Created by")} ${cb(THEME.text, "Zain Afzal")}  ${subtle(SYM.bullet)}  ${c(THEME.accent, "zainafzal.dev")}`)
  console.log(`  ${subtle(SYM.dash.repeat(44))}`)
  console.log("")
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
  const pctColor = pct >= 80 ? THEME.green : pct >= 50 ? THEME.yellow : THEME.red

  console.log(sectionLine("Scan Results"))
  console.log("")
  console.log(`    ${c(THEME.textSecondary, "Total")}        ${cb(THEME.text, String(total))}`)
  console.log(`    ${c(THEME.green, "Set")}          ${cb(THEME.green, String(alreadySet))}`)
  console.log(`    ${c(THEME.red, "Missing")}      ${cb(THEME.red, String(missing))}`)
  console.log("")
  console.log(`    ${progressBar(alreadySet, total)}  ${cb(pctColor, pct + "%")} ${dim("coverage")}`)
  console.log("")

  return {total, alreadySet, missing}
}

// ─── Mode Selector ──────────────────────────────────────────────────────────────

async function askMode(missingCount, alreadySetCount) {
  console.log(sectionLine("Action"))
  console.log("")

  const choices = []

  if (missingCount > 0) {
    choices.push({
      name: `  ${c(THEME.accent, SYM.triRight)} Fill missing variables  ${dim("(" + missingCount + ")")}`,
      value: "missing",
    })
  }

  if (alreadySetCount > 0) {
    const editLabel = missingCount > 0 ? "Edit all variables" : "Edit existing variables"
    const editCount = missingCount > 0 ? missingCount + alreadySetCount : alreadySetCount
    choices.push({
      name: `  ${c(THEME.purple, "✎")} ${editLabel}  ${dim("(" + editCount + ")")}`,
      value: "all",
    })
  }

  choices.push({
    name: `  ${c(THEME.cyan, "⬆")} Bulk paste  ${dim("paste entire .env content")}`,
    value: "bulk",
  })

  choices.push({
    name: `  ${c(THEME.textMuted, SYM.cross)} Exit`,
    value: "exit",
  })

  const {mode} = await inquirer.prompt([{
    type: "list",
    name: "mode",
    message: cb(THEME.textSecondary, "Select mode"),
    choices,
    pageSize: 8,
    prefix: c(THEME.accent, "  ?"),
  }])

  return mode
}

// ─── Env File Selector ──────────────────────────────────────────────────────────

const WRITABLE_ENV_FILES = [".env", ".env.local", ".env.development", ".env.production"]

async function askEnvFile(cwd) {
  console.log(sectionLine("Target File"))
  console.log("")

  let allFiles = []
  try {
    allFiles = fs.readdirSync(cwd).filter(f => {
      if (!f.startsWith(".env")) return false
      try { return fs.statSync(path.join(cwd, f)).isFile() } catch { return false }
    }).sort()
  } catch {
    // fallback
  }

  const choices = []

  if (allFiles.length > 0) {
    allFiles.forEach(f => {
      const isExample = f.includes("example") || f.includes("sample") || f.includes("template")
      const tagText = isExample ? "template" : "exists"
      choices.push({
        name: `  ${c(THEME.green, SYM.check)} ${cb(THEME.text, f)}  ${dim(tagText)}`,
        value: f,
      })
    })
  }

  const missingStandard = WRITABLE_ENV_FILES.filter(f => !allFiles.includes(f))
  if (missingStandard.length > 0) {
    if (choices.length > 0) {
      choices.push(new inquirer.Separator(subtle("    " + SYM.dash.repeat(30))))
    }
    missingStandard.forEach(f => {
      choices.push({
        name: `  ${c(THEME.textSubtle, "+")} ${c(THEME.textSecondary, f)}  ${dim("create new")}`,
        value: f,
      })
    })
  }

  choices.push({name: `  ${c(THEME.textMuted, SYM.ellipsis)} Custom path`, value: "custom"})

  const {envFile} = await inquirer.prompt([{
    type: "list",
    name: "envFile",
    message: cb(THEME.textSecondary, "Write to"),
    choices,
    pageSize: 12,
    prefix: c(THEME.accent, "  ?"),
  }])

  if (envFile === "custom") {
    const {customPath} = await inquirer.prompt([{
      type: "input",
      name: "customPath",
      message: cb(THEME.textSecondary, "Enter path"),
      default: ".env",
      prefix: c(THEME.accent, "  ?"),
      validate: input => {
        if (!input || !input.trim()) return chalk.hex(THEME.red)("Path cannot be empty")
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

  console.log(commandPanel())

  for (let i = 0; i < varList.length; i++) {
    const varName = varList[i]
    const currentValue = existingEnv.get(varName) || ""
    const locations = foundVars.get(varName)
    const secretLike = isSensitiveKey(varName)
    const stepNum = i + 1
    const hint = getValueHint(varName)

    // ─── Category Header ─────────────────────────────
    const category = getCategory(varName)
    if (category && category !== lastCategory) {
      console.log("")
      console.log(`  ${cb(THEME.purple, category)}`)
      lastCategory = category
    }

    // ─── Variable Card ───────────────────────────────
    const pct = Math.round((i / total) * 100)

    const cardLines = []

    // Header line: name + counter
    cardLines.push(
      `${cb(THEME.text, varName)}  ${subtle(`${stepNum}/${total}`)}  ${subtle(pct + "%")}`,
    )

    // Progress bar
    cardLines.push(progressBar(i, total, 28))

    // Type hint
    if (hint) {
      const typeColor = hint.type === "Secret" ? THEME.yellow : THEME.accent
      cardLines.push(`${c(typeColor, hint.type)} ${subtle(SYM.triSmall)} ${dim(hint.hint)}`)
    }

    // Source files
    if (locations && locations.size > 0) {
      const files = [...locations].slice(0, 3)
      const extra = locations.size > 3 ? dim(` +${locations.size - 3} more`) : ""
      cardLines.push(`${dim("in")} ${files.map(f => c(THEME.textSecondary, f)).join(dim(", "))}${extra}`)
    }

    // Current value
    if (currentValue) {
      cardLines.push(`${statusDot(THEME.green)} ${dim("current:")} ${dim(maskValue(currentValue))}`)
    } else {
      cardLines.push(`${statusDot(THEME.yellow)} ${dim("not set")}`)
    }

    console.log("")
    console.log(boxen(cardLines.join("\n"), {
      padding: {top: 0, bottom: 0, left: 1, right: 1},
      margin: {top: 0, bottom: 0, left: 1, right: 0},
      borderStyle: "round",
      borderColor: THEME.border,
    }))

    // ─── Value Input ─────────────────────────────────
    while (true) {
      const promptIcon = secretLike
        ? c(THEME.yellow, "  " + SYM.diamond)
        : c(THEME.accent, "  " + SYM.triSmall)

      const {value} = await inquirer.prompt([{
        type: secretLike ? "password" : "input",
        mask: secretLike ? "•" : undefined,
        name: "value",
        message: cb(THEME.textSecondary, secretLike ? "Secret" : "Value"),
        default: currentValue || undefined,
        prefix: promptIcon,
      }])

      const trimmed = value.trim()
      const cmd = trimmed.toLowerCase()

      // ─── Command: exit ──────────────────────────────
      if (cmd === "quit" || cmd === "exit") {
        const {confirmExit} = await inquirer.prompt([{
          type: "confirm",
          name: "confirmExit",
          message: dim("End session? Saved values are kept."),
          default: true,
          prefix: c(THEME.yellow, "  " + SYM.warn),
        }])
        if (confirmExit) {
          console.log("")
          console.log(`  ${c(THEME.yellow, SYM.warn)} ${dim("Session ended early.")}`)
          console.log("")
          exitRequested = true
          break
        }
        continue
      }

      // ─── Command: help ──────────────────────────────
      if (cmd === "help" || cmd === "?") {
        console.log(commandPanel())
        continue
      }

      // ─── Command: list ──────────────────────────────
      if (cmd === "list") {
        const remaining = varList.slice(i + 1)
        if (remaining.length === 0) {
          console.log(dim("    This is the last variable."))
        } else {
          console.log(dim(`    Remaining (${remaining.length}):`))
          remaining.forEach((v, idx) => {
            const cat = getCategory(v)
            const catLabel = cat ? dim(` [${cat}]`) : ""
            const num = subtle(`${(idx + 1).toString().padStart(2)}.`)
            console.log(`      ${num} ${c(THEME.textSecondary, v)}${catLabel}`)
          })
        }
        console.log("")
        continue
      }

      // ─── Command: back ──────────────────────────────
      if (cmd === "back") {
        if (i === 0) {
          console.log(dim(`    ${SYM.arrow} Already at first variable`))
          continue
        }
        i -= 2
        lastCategory = null
        console.log(dim(`    ${SYM.arrow} Going back...`))
        break
      }

      // ─── Command: skip ──────────────────────────────
      if (cmd === "skip") {
        skippedCount += 1
        console.log(`  ${subtle(SYM.arrow)} ${dim("skipped")}`)
        break
      }

      // ─── Command: skipall ───────────────────────────
      if (cmd === "skipall") {
        const remaining = total - (i + 1)
        const {confirmSkip} = await inquirer.prompt([{
          type: "confirm",
          name: "confirmSkip",
          message: dim(`Skip all ${remaining + 1} remaining?`),
          default: false,
          prefix: c(THEME.yellow, "  " + SYM.warn),
        }])
        if (confirmSkip) {
          skippedCount += remaining + 1
          console.log(dim(`    ${SYM.arrow} Skipped ${remaining + 1} variables`))
          exitRequested = true
          break
        }
        continue
      }

      // ─── Save Value ────────────────────────────────
      const finalValue = cmd === "clear" ? "" : value

      if (typeof onSetValue === "function") {
        await onSetValue(varName, finalValue)
      }

      results.set(varName, finalValue)
      const unchanged = currentValue === finalValue
      const icon = unchanged ? subtle(SYM.check) : c(THEME.green, SYM.check)
      const saveText = unchanged ? dim("unchanged") : c(THEME.green, "saved")
      const remaining = total - (i + 1)
      const stats = subtle(`${results.size} done ${SYM.bullet} ${skippedCount} skipped ${SYM.bullet} ${remaining} left`)

      console.log(`  ${icon} ${saveText}  ${subtle(SYM.bar)}  ${stats}`)
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
    console.log(`  ${c(THEME.yellow, SYM.warn)}  ${cb(THEME.yellow, "No changes made")}`)
    console.log(`     ${dim("All variables were skipped or already set.")}`)
    console.log("")
    return
  }

  const lines = [
    "",
    `  ${c(THEME.green, SYM.check)}  ${cb(THEME.green, "Done")}`,
    "",
    `     ${dim("Saved")}      ${cb(THEME.text, String(saved))} ${dim(saved > 1 ? "variables" : "variable")}`,
    `     ${dim("Target")}     ${cb(THEME.accent, envFilePath)}`,
    "",
    `     ${subtle("Make sure " + envFilePath + " is in .gitignore")}`,
    "",
  ].join("\n")

  console.log(lines)
}

// ─── Folder Picker ──────────────────────────────────────────────────────────────

function askFolder(folders) {
  if (folders.length <= 1) {
    return Promise.resolve(folders[0] || null)
  }

  console.log(sectionLine("Project Folders"))
  console.log("")
  console.log(dim("  Multiple folders with env files detected:"))
  console.log("")

  const choices = folders.map(folder => {
    const isRoot = folder.relPath === "."
    const folderName = isRoot ? "./ (root)" : folder.relPath
    const fileCount = folder.envFiles.length
    const fileList = folder.envFiles
      .map(f => c(THEME.textSecondary, f))
      .join(dim(", "))

    return {
      name: `  ${c(THEME.accent, SYM.triSmall)} ${cb(THEME.text, folderName)}  ${dim(`${fileCount} file${fileCount > 1 ? "s" : ""}:`)} ${fileList}`,
      value: folder,
      short: folderName,
    }
  })

  choices.push(new inquirer.Separator(subtle("    " + SYM.dash.repeat(30))))
  choices.push({
    name: `  ${c(THEME.purple, "+")} ${c(THEME.purple, "Edit all folders")} ${dim(`(${folders.length})`)}`,
    value: "all",
    short: "All folders",
  })

  return inquirer.prompt([{
    type: "list",
    name: "folder",
    message: cb(THEME.textSecondary, "Select folder"),
    choices,
    pageSize: 15,
    prefix: c(THEME.accent, "  ?"),
  }]).then(a => a.folder)
}

// ─── Bulk Paste ─────────────────────────────────────────────────────────────────

function parseBulkInput(raw) {
  const result = new Map()
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.substring(0, eqIndex).trim()
    let value = trimmed.substring(eqIndex + 1).trim()

    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

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
  console.log(sectionLine("Bulk Paste"))
  console.log("")
  console.log(dim("  Paste your env content below and press Enter."))
  console.log(dim("  Trailing empty lines are automatically ignored."))
  console.log("")

  const collectedLines = []

  const content = await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: c(THEME.accent, "  " + SYM.triSmall + " "),
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
      if (line.trim() === "" && collectedLines.length > 0) {
        finish()
        return
      }

      if (line.trim() === "" && collectedLines.length === 0) {
        rl.prompt()
        return
      }

      collectedLines.push(line)

      const varCount = parseBulkInput(collectedLines.join("\n")).size
      console.log(dim(`     ${SYM.check} ${varCount} var${varCount !== 1 ? "s" : ""} detected`))

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
    console.log(dim("  No content pasted."))
    return null
  }

  const parsed = parseBulkInput(content)

  if (parsed.size === 0) {
    console.log(`  ${c(THEME.yellow, SYM.warn)} ${dim("No valid KEY=VALUE pairs found.")}`)
    console.log(dim("  Expected format: KEY=value or KEY=\"value\""))
    console.log("")
    return null
  }

  const keys = [...parsed.keys()]
  const secretKeys = keys.filter(k => isSensitiveKey(k))
  const publicKeys = keys.filter(k => !isSensitiveKey(k))

  console.log("")
  console.log(sectionLine(`Found ${keys.length} variable${keys.length > 1 ? "s" : ""}`))
  console.log("")

  publicKeys.forEach(k => {
    const val = parsed.get(k)
    const displayVal = val ? c(THEME.textSecondary, val.length > 40 ? val.substring(0, 37) + "..." : val) : dim("(empty)")
    console.log(`    ${c(THEME.green, SYM.check)} ${c(THEME.text, k)} ${subtle("=")} ${displayVal}`)
  })
  secretKeys.forEach(k => {
    console.log(`    ${c(THEME.green, SYM.check)} ${c(THEME.text, k)} ${subtle("=")} ${dim(maskValue(parsed.get(k)))}  ${dim("[secret]")}`)
  })
  console.log("")

  const {confirm} = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: cb(THEME.textSecondary, `Write ${keys.length} variable${keys.length > 1 ? "s" : ""}?`),
    default: true,
    prefix: c(THEME.accent, "  ?"),
  }])

  if (!confirm) {
    console.log(dim("  Cancelled."))
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
