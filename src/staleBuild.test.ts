import { describe, expect, it } from 'vitest'
import { isStaleBuildError } from './staleBuild'

describe('isStaleBuildError', () => {
  it('recognizes each browser’s message for a missing on-demand file', () => {
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/fill-abc.js'))).toBe(true) // Chrome, Edge
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true) // Safari
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module: https://x/assets/fill-abc.js'))).toBe(true) // Firefox
  })
  it('leaves other errors alone', () => {
    expect(isStaleBuildError(new Error('Could not load the blank form'))).toBe(false)
  })
})
