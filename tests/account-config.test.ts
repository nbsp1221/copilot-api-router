import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  getAccountsConfig,
  resetAccountsConfigCache,
} from "~/lib/account-config"

const TMP_PREFIX = "copilot-account-config-"

function writeTempConfig(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX))
  const filePath = path.join(dir, "config.yaml")
  fs.writeFileSync(filePath, contents)
  return filePath
}

afterEach(() => {
  resetAccountsConfigCache()
  delete process.env.ACCOUNTS_CONFIG
})

describe("getAccountsConfig", () => {
  test("parses accounts and uses first entry as default", () => {
    const configPath = writeTempConfig(`
accounts:
  - id: primary
    github_token: token-one
  - id: backup
    github_token: token-two
`)
    process.env.ACCOUNTS_CONFIG = configPath

    const config = getAccountsConfig()

    expect(config.accounts).toHaveLength(2)
    expect(config.accounts[0]).toEqual({
      id: "primary",
      githubToken: "token-one",
    })
    expect(config.defaultAccountId).toBe("primary")
  })

  test("substitutes environment variables in github_token values", () => {
    const configPath = writeTempConfig(`
accounts:
  - id: env-account
    github_token: \${GITHUB_TOKEN_EXAMPLE}
`)
    process.env.ACCOUNTS_CONFIG = configPath
    process.env.GITHUB_TOKEN_EXAMPLE = "env-token"

    const config = getAccountsConfig()

    expect(config.accounts[0]?.githubToken).toBe("env-token")
  })

  test("throws when referenced environment variable is missing", () => {
    const configPath = writeTempConfig(`
accounts:
  - id: missing-env
    github_token: \${GITHUB_TOKEN_MISSING}
`)
    process.env.ACCOUNTS_CONFIG = configPath

    expect(() => getAccountsConfig()).toThrow(/GITHUB_TOKEN_MISSING/)
  })
})
