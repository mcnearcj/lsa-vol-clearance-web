/** Formats SSN digits as XXX-XX-XXXX while typing. A dash only appears once a digit follows it, so Backspace never gets stuck on one. */
export function ssnAsTyped(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 9)
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join('-')
}
