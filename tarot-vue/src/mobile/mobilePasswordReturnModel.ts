// This is a navigation signal, never proof that a reset succeeded. Do not add
// credentials, reset tokens, email addresses or arbitrary destination parameters.
export const MOBILE_PASSWORD_RETURN_URL = 'etomd://auth/password-reset-complete'

export function isMobilePasswordReturnUrl(value: unknown): value is typeof MOBILE_PASSWORD_RETURN_URL {
  return value === MOBILE_PASSWORD_RETURN_URL
}

export function supportsAndroidPasswordReturn(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent)
}
