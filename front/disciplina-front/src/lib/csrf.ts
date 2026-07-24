export const CSRF_COOKIE = 'disc_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export function getCsrfCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`))
    ?.split('=')[1]
}
