import fs from 'fs'
import { expect, type Page } from '@playwright/test'

type SupabaseTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  token_type: string
  user: unknown
}

const envLocal = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx), line.slice(idx + 1)]
    })
)

const supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
const cookieName = `sb-${projectRef}-auth-token`
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'

function getCookieUrls() {
  const primary = new URL(baseUrl)
  const urls = new Set([primary.origin])

  if (primary.hostname === '127.0.0.1') {
    urls.add(`http://localhost:${primary.port}`)
  } else if (primary.hostname === 'localhost') {
    urls.add(`http://127.0.0.1:${primary.port}`)
  }

  return Array.from(urls)
}

function toBase64Url(input: string) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function authenticate(email: string, password: string): Promise<SupabaseTokenResponse> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json() as SupabaseTokenResponse | { error_description?: string }
  if (!response.ok) {
    throw new Error(`Supabase auth failed: ${JSON.stringify(payload)}`)
  }

  return payload as SupabaseTokenResponse
}

export async function login(page: Page, email: string, password: string) {
  const session = await authenticate(email, password)
  const sessionCookie = `base64-${toBase64Url(JSON.stringify(session))}`

  await page.context().addCookies(getCookieUrls().map(url => ({
    name: cookieName,
    value: sessionCookie,
    url,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  })))

  await page.goto('/records')
  await expect(page).toHaveURL(/\/records$/)
}

export function requireEnv(...keys: string[]) {
  for (const key of keys) {
    if (!process.env[key]) {
      return `Missing required env: ${key}`
    }
  }
  return null
}
