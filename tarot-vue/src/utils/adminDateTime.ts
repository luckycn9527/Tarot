export function adminDateTime(value: unknown, locale: string, missing: string): string {
  if (!value) return missing
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return missing
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date)
}
