import consola from "consola"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "config.yaml")

export interface AccountDefinition {
  id: string
  githubToken: string
}

export interface AccountsConfig {
  accounts: Array<AccountDefinition>
  defaultAccountId: string
}

let cachedConfig: AccountsConfig | null = null

export function resetAccountsConfigCache(): void {
  cachedConfig = null
}

export function getAccountsConfig(): AccountsConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const configPath =
    (
      process.env.ACCOUNTS_CONFIG
      && process.env.ACCOUNTS_CONFIG.trim().length > 0
    ) ?
      path.resolve(process.env.ACCOUNTS_CONFIG)
    : DEFAULT_CONFIG_PATH

  const contents = readConfigFile(configPath)
  const parsed = parseConfig(contents, configPath)
  cachedConfig = parsed
  return parsed
}

function readConfigFile(configPath: string): string {
  try {
    return fs.readFileSync(configPath, "utf8")
  } catch (error) {
    consola.error(
      `accounts config not found at ${configPath}. Provide a config.yaml or set ACCOUNTS_CONFIG`,
      error,
    )
    throw error
  }
}

function parseConfig(raw: string, sourcePath: string): AccountsConfig {
  let document: unknown
  try {
    document = parse(raw) ?? {}
  } catch (error) {
    throw new Error(
      `Failed to parse accounts config (${sourcePath}): ${(error as Error).message}`,
    )
  }

  const accountsValue = (document as { accounts?: unknown }).accounts
  if (!Array.isArray(accountsValue) || accountsValue.length === 0) {
    throw new Error(
      `Accounts config must define at least one account in ${sourcePath}`,
    )
  }

  const accounts = accountsValue.map((account, index) =>
    normalizeAccount(account, index, sourcePath),
  )

  return {
    accounts,
    defaultAccountId: accounts[0].id,
  }
}

function normalizeAccount(
  account: unknown,
  index: number,
  sourcePath: string,
): AccountDefinition {
  if (typeof account !== "object" || account === null) {
    throw new Error(
      `Account entry at index ${index} in ${sourcePath} must be an object`,
    )
  }

  const id = (account as { id?: unknown }).id
  const githubToken = (account as { github_token?: unknown }).github_token

  if (typeof id !== "string" || id.trim() === "") {
    throw new Error(
      `Account entry at index ${index} in ${sourcePath} must include a non-empty "id"`,
    )
  }

  if (typeof githubToken !== "string" || githubToken.trim() === "") {
    throw new Error(
      `Account "${id}" in ${sourcePath} must include a non-empty "github_token"`,
    )
  }

  return {
    id,
    githubToken: resolveEnvReferences(githubToken, id),
  }
}

const ENV_REF_REGEX = /\$(?:\{(\w+)\}|(\w+))/g

function resolveEnvReferences(value: string, accountId: string): string {
  return value.replaceAll(
    ENV_REF_REGEX,
    (_match, bracketedVar?: string, bareVar?: string) => {
      const variableName = (bracketedVar ?? bareVar ?? "").trim()
      if (!variableName) {
        return ""
      }
      const envValue = process.env[variableName]
      if (typeof envValue !== "string" || envValue === "") {
        throw new Error(
          `Account "${accountId}" requires environment variable "${variableName}" to be set`,
        )
      }
      return envValue
    },
  )
}
