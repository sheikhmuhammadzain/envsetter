"use strict"

const chalk = require("chalk")
const inquirer = require("inquirer")
const boxen = require("boxen")
const figures = require("figures")

// ─── Design System ──────────────────────────────────────────────────────────────
const THEME = {
  // Primary palette — cyan gradient feel
  primary: "#00D4FF",
  primaryDim: "#0097B2",
  // Accent
  accent: "#A78BFA",
  accentDim: "#7C5CBF",
  // Semantic
  success: "#34D399",
  successDim: "#059669",
  warning: "#FBBF24",
  warningDim: "#D97706",
  danger: "#F87171",
  dangerDim: "#DC2626",
  // Neutrals
  text: "#E2E8F0",
  textDim: "#94A3B8",
  muted: "#64748B",
  subtle: "#475569",
  bg: "#1E293B",
}

// ─── Box Characters (consistent design language) ────────────────────────────────
const BOX = {
  tl: "╭", tr: "╮", bl: "╰", br: "╯",
  h: "─", v: "│",
  hBold: "━", vBold: "┃",
  dot: "●", ring: "○", diamond: "◆",
  arrow: "▸", arrowRight: "→",
  check: "✔", cross: "✖", warn: "⚠",
  bar: "█", barHalf: "▓", barLight: "░",
  ellipsis: "…",
}

const COMMANDS = ["skip", "back", "clear", "list", "help", "exit"]

// ─── Utility Helpers ────────────────────────────────────────────────────────────

function c(hex, text) {
  return chalk.hex(hex)(text)
}

function cBold(hex, text) {
  return chalk.bold.hex(hex)(text)
}

function dim(text) {
  return chalk.hex(THEME.muted)(text)
}

function subtle(text) {
  return chalk.hex(THEME.subtle)(text)
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function pad(str, width) {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "")
  return str + " ".repeat(Math.max(0, width - visible.length))
}

function centerText(text, width) {
  const visible = text.replace(/\x1b\[[0-9;]*m/g, "")
  const totalPad = Math.max(0, width - visible.length)
  const leftPad = Math.floor(totalPad / 2)
  const rightPad = totalPad - leftPad
  return " ".repeat(leftPad) + text + " ".repeat(rightPad)
}

// ─── Progress Bar (Gradient-style) ──────────────────────────────────────────────

function progressBar(done, total, width = 28) {
  if (total <= 0) return dim("░".repeat(width))

  const ratio = clamp(done / total, 0, 1)
  const filled = Math.round(ratio * width)
  const empty = width - filled

  // Gradient: primary → accent as it fills
  const filledBar = c(THEME.primary, "█".repeat(Math.ceil(filled / 2))) +
    c(THEME.accent, "█".repeat(Math.floor(filled / 2)))
  const emptyBar = chalk.hex(THEME.subtle)("░".repeat(empty))

  return filledBar + emptyBar
}

// ─── Mini Badge Components ──────────────────────────────────────────────────────

function badge(label, color) {
  return chalk.bgHex(color).hex("#0F172A").bold(` ${label} `)
}

function statusDot(color) {
  return chalk.hex(color)(BOX.dot)
}

function label(text) {
  return chalk.hex(THEME.textDim)(text)
}

// ─── Divider ────────────────────────────────────────────────────────────────────

function divider(width = 52) {
  const left = c(THEME.primaryDim, BOX.h.repeat(3))
  const right = c(THEME.subtle, BOX.h.repeat(width - 3))
  return left + right
}

function sectionHeader(title, icon = BOX.diamond) {
  const iconStr = c(THEME.accent, icon)
  const titleStr = cBold(THEME.text, title)
  const line = c(THEME.subtle, BOX.h.repeat(Math.max(2, 42 - title.length)))
  return `  ${iconStr} ${titleStr} ${line}`
}

// ─── Command Panel ──────────────────────────────────────────────────────────────

function commandPanel() {
  const header = cBold(THEME.textDim, "  Quick Commands")
  const sep = dim("  " + BOX.h.repeat(46))

  const cmds = [
    [`${cBold(THEME.primary, "skip")}`, dim("Skip this variable")],
    [`${cBold(THEME.primary, "back")}`, dim("Go to previous variable")],
    [`${cBold(THEME.warning, "clear")}`, dim("Set empty value")],
    [`${cBold(THEME.accent, "list")}`, dim("Show remaining variables")],
    [`${cBold(THEME.textDim, "help")}`, dim("Show this panel")],
    [`${cBold(THEME.danger, "exit")}`, dim("Finish and save")],
  ]

  const colWidth = 12
  const rows = []
  for (let i = 0; i < cmds.length; i += 2) {
    const left = `    ${pad(cmds[i][0], colWidth)} ${pad(cmds[i][1], 22)}`
    const right = cmds[i + 1]
      ? `${pad(cmds[i + 1][0], colWidth)} ${cmds[i + 1][1]}`
      : ""
    rows.push(left + right)
  }

  const hint = `  ${dim(BOX.arrow)} ${dim("Press")} ${cBold(THEME.textDim, "Enter")} ${dim("to keep current value")}`

  return [header, sep, ...rows, "", hint, ""].join("\n")
}

// ─── Banner ─────────────────────────────────────────────────────────────────────

function showBanner() {
  // ASCII art using only standard monospace-safe characters
  const art = [
    " _____ _   ___     __",
    "| ____| \\ | \\ \\   / /",
    "|  _| |  \\| |\\ \\ / / ",
    "| |___| |\\  | \\ V /  ",
    "|_____|_| \\_|  \\_/   ",
  ]

  const setterText = "S E T T E R"

  // Color the art with gradient
  const gradientColors = [
    THEME.primary,
    THEME.primary,
    THEME.accent,
    THEME.accent,
    THEME.accentDim,
  ]

  const coloredArt = art.map((line, i) => cBold(gradientColors[i], line))

  // Build banner content
  const inner = [
    "",
    ...coloredArt,
    "",
    `  ${c(THEME.primaryDim, "---")} ${cBold(THEME.primary, setterText)} ${c(THEME.primaryDim, "---")}`,
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

  const bar = progressBar(alreadySet, total)
  const pctColor = pct >= 80 ? THEME.success : pct >= 50 ? THEME.warning : THEME.danger

  // Build the summary card
  const lines = [
    sectionHeader("Scan Results"),
    "",
    `    ${statusDot(THEME.warning)}  ${label("Variables found")}   ${cBold(THEME.text, total.toString().padStart(4))}`,
    `    ${statusDot(THEME.success)}  ${label("Already set")}      ${cBold(THEME.success, alreadySet.toString().padStart(4))}`,
    `    ${statusDot(THEME.danger)}  ${label("Missing")}          ${cBold(THEME.danger, missing.toString().padStart(4))}`,
    "",
    `    ${label("Coverage")}  ${bar}  ${cBold(pctColor, pct + "%")}`,
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

// ─── Source Locations ────────────────────────────────────────────────────────────

function showVarLocations(locations) {
  if (!locations || locations.size === 0) return

  const maxShown = 4
  const files = [...locations].slice(0, maxShown)
  const extra = locations.size > maxShown ? dim(` +${locations.size - maxShown} more`) : ""

  console.log(dim(`    ${BOX.arrow} Found in:`))
  files.forEach(file => {
    console.log(`      ${c(THEME.accent, BOX.arrowRight)} ${c(THEME.textDim, file)}`)
  })
  if (extra) console.log(`      ${extra}`)
}

// ─── Mode Selector ──────────────────────────────────────────────────────────────

async function askMode(missingCount, alreadySetCount) {
  console.log(sectionHeader("Choose Action", "▸"))
  console.log("")

  const choices = []

  if (missingCount > 0) {
    choices.push({
      name: `${c(THEME.primary, BOX.arrow)} Fill missing only  ${badge(missingCount.toString(), THEME.primaryDim)}`,
      value: "missing",
    })
  }

  if (alreadySetCount > 0) {
    choices.push({
      name: `${c(THEME.accent, "✎")} Edit all variables  ${badge((missingCount + alreadySetCount).toString(), THEME.accentDim)}`,
      value: "all",
    })
  }

  if (missingCount === 0 && alreadySetCount > 0) {
    choices.push({
      name: `${c(THEME.accent, "✎")} Edit existing  ${badge(alreadySetCount.toString(), THEME.accentDim)}`,
      value: "all",
    })
  }

  choices.push({
    name: `${c(THEME.danger, BOX.cross)} Exit`,
    value: "exit",
  })

  const {mode} = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: cBold(THEME.textDim, "Select mode"),
      choices,
      pageSize: 8,
      prefix: c(THEME.accent, "  ?"),
    },
  ])

  return mode
}

// ─── Env File Selector ──────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const ENV_FILE_OPTIONS = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
]

async function askEnvFile(cwd) {
  console.log(sectionHeader("Target File", ">>"))
  console.log("")

  // Detect which env files actually exist
  const existing = ENV_FILE_OPTIONS.filter(f =>
    fs.existsSync(path.join(cwd, f)),
  )

  const choices = []

  // Show existing files first with a green dot
  existing.forEach((f, i) => {
    const isDefault = f === ".env"
    const suffix = isDefault ? dim(" (default)") : ""
    choices.push({
      name: `${statusDot(THEME.success)} ${c(THEME.text, f)}${suffix}`,
      value: f,
    })
  })

  // Separator if we have existing files
  if (existing.length > 0) {
    choices.push(new inquirer.Separator(dim("  ─── create new ───")))
  }

  // Show non-existing files as "create new" options
  const missing = ENV_FILE_OPTIONS.filter(f => !existing.includes(f))
  missing.forEach(f => {
    choices.push({
      name: `${statusDot(THEME.muted)} ${c(THEME.textDim, f)} ${dim("(new)")}`,
      value: f,
    })
  })

  // Always show custom path
  choices.push({
    name: `${c(THEME.accent, "…")} Custom path`,
    value: "custom",
  })

  const {envFile} = await inquirer.prompt([
    {
      type: "list",
      name: "envFile",
      message: cBold(THEME.textDim, "Write to"),
      choices,
      pageSize: 10,
      prefix: c(THEME.accent, "  ?"),
    },
  ])

  if (envFile === "custom") {
    const {customPath} = await inquirer.prompt([
      {
        type: "input",
        name: "customPath",
        message: cBold(THEME.textDim, "Enter path"),
        default: ".env",
        prefix: c(THEME.accent, "  ?"),
        validate: input => {
          if (!input || !input.trim()) return chalk.hex(THEME.danger)("Path cannot be empty")
          return true
        },
      },
    ])
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

  // Show commands panel once at start
  console.log("")
  console.log(commandPanel())

  for (let i = 0; i < varList.length; i++) {
    const varName = varList[i]
    const currentValue = existingEnv.get(varName) || ""
    const locations = foundVars.get(varName)
    const secretLike = isSensitiveKey(varName)
    const stepNum = i + 1

    // ─── Variable Header Card ───────────────────────────
    const pct = Math.round((i / total) * 100)
    const bar = progressBar(i, total, 22)

    const stepLabel = dim(`${stepNum}/${total}`)
    const pctLabel = dim(`${pct}%`)

    const headerLine1 = `  ${c(THEME.primary, BOX.diamond)} ${cBold(THEME.text, varName)}`
    const headerLine2 = `  ${bar} ${stepLabel} ${pctLabel}`

    // Status indicator
    const statusLine = currentValue
      ? `  ${statusDot(THEME.success)} ${dim("Current:")} ${dim(maskValue(currentValue))}`
      : `  ${statusDot(THEME.warning)} ${dim("Not set")}`

    console.log("")
    console.log(c(THEME.subtle, "  " + BOX.h.repeat(50)))
    console.log(headerLine1)
    console.log(headerLine2)

    // Show source locations (compact)
    if (locations && locations.size > 0) {
      const maxShown = 3
      const files = [...locations].slice(0, maxShown)
      const extra = locations.size > maxShown ? dim(` +${locations.size - maxShown}`) : ""
      const fileList = files.map(f => c(THEME.textDim, f)).join(dim(", "))
      console.log(`  ${dim(BOX.arrow + " in:")} ${fileList}${extra}`)
    }

    console.log(statusLine)
    console.log("")

    // ─── Value Input ────────────────────────────────────
    while (true) {
      const promptIcon = secretLike
        ? c(THEME.warning, "  🔒")
        : c(THEME.primary, "  " + BOX.arrow)

      const {value} = await inquirer.prompt([
        {
          type: secretLike ? "password" : "input",
          mask: secretLike ? "•" : undefined,
          name: "value",
          message: cBold(THEME.text, secretLike ? "Secret" : "Value"),
          default: currentValue || undefined,
          prefix: promptIcon,
        },
      ])

      const trimmed = value.trim()
      const cmd = trimmed.toLowerCase()

      // ─── Command Handling ───────────────────────────────
      if (cmd === "quit" || cmd === "exit") {
        console.log(c(THEME.warning, `\n  ${BOX.warn} Session ended early — all saved values are kept.\n`))
        exitRequested = true
        break
      }

      if (cmd === "help" || cmd === "?") {
        console.log("")
        console.log(commandPanel())
        continue
      }

      if (cmd === "list") {
        const remaining = varList.slice(i + 1)
        if (remaining.length === 0) {
          console.log(dim("    This is the last variable."))
        } else {
          console.log(dim(`    Remaining (${remaining.length}):`))
          remaining.forEach((v, idx) => {
            const num = dim(`${(idx + 1).toString().padStart(2)}.`)
            console.log(`      ${num} ${c(THEME.textDim, v)}`)
          })
        }
        console.log("")
        continue
      }

      if (cmd === "back") {
        if (i === 0) {
          console.log(dim(`    ${BOX.arrowRight} Already at first variable`))
          continue
        }
        i -= 2
        console.log(dim(`    ${BOX.arrowRight} Going back…`))
        break
      }

      if (cmd === "skip") {
        skippedCount += 1
        console.log(`  ${c(THEME.textDim, BOX.arrowRight)} ${dim("Skipped")}`)
        break
      }

      // ─── Save Value ─────────────────────────────────────
      const finalValue = cmd === "clear" ? "" : value

      if (typeof onSetValue === "function") {
        await onSetValue(varName, finalValue)
      }

      results.set(varName, finalValue)
      const unchanged = currentValue === finalValue
      const icon = unchanged ? c(THEME.textDim, BOX.check) : c(THEME.success, BOX.check)
      const saveText = unchanged
        ? c(THEME.textDim, "Unchanged")
        : c(THEME.success, "Saved")
      const remaining = total - (i + 1)
      const stats = dim(`${results.size} done · ${skippedCount} skipped · ${remaining} left`)

      console.log(`  ${icon} ${saveText}  ${dim("│")}  ${stats}`)
      break
    }

    if (exitRequested) break
  }

  return results
}

// ─── Masking Sensitive Values ───────────────────────────────────────────────────

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
    centerText(c(THEME.success, "✔") + "  " + cBold(THEME.success, "Complete"), 48),
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

module.exports = {
  showBanner,
  showScanResult,
  askMode,
  askEnvFile,
  promptForValues,
  showSummary,
}
