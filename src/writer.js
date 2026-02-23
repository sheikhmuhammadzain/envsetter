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
    // Don't auto-modify, just warn â€” handled in UI
    return false
  }

  return true
}

module.exports = {writeEnvFile, ensureGitignore}
