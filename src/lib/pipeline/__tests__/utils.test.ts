import { describe, it, expect, vi } from 'vitest'
import { extractArxivId, chunked, sleep } from '@/lib/pipeline/utils'

describe('extractArxivId', () => {
  it('extracts a new-format id and strips the version suffix', () => {
    expect(extractArxivId('http://arxiv.org/abs/2401.12345v1')).toBe('2401.12345')
    expect(extractArxivId('https://arxiv.org/abs/2401.12345v3')).toBe('2401.12345')
  })

  it('handles a new-format id without a version suffix', () => {
    expect(extractArxivId('https://arxiv.org/abs/2401.12345')).toBe('2401.12345')
  })

  it('accepts the 4-digit new-format variant', () => {
    expect(extractArxivId('http://arxiv.org/abs/2401.1234')).toBe('2401.1234')
  })

  it('extracts an old-format (subject-class) id and strips the version', () => {
    expect(extractArxivId('http://arxiv.org/abs/hep-th/9901001v1')).toBe('hep-th/9901001')
    expect(extractArxivId('http://arxiv.org/abs/cs.CL/0509001')).toBe('cs.CL/0509001')
  })

  it('falls back to the raw input when nothing matches', () => {
    expect(extractArxivId('not-an-arxiv-url')).toBe('not-an-arxiv-url')
  })
})

describe('chunked', () => {
  it('splits an array into chunks of the given size with a trailing remainder', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('returns an empty array for empty input', () => {
    expect(chunked([], 3)).toEqual([])
  })

  it('returns a single chunk when size equals the length', () => {
    expect(chunked([1, 2, 3], 3)).toEqual([[1, 2, 3]])
  })

  it('returns a single chunk when size exceeds the length', () => {
    expect(chunked([1, 2], 5)).toEqual([[1, 2]])
  })

  it('handles a chunk size of 1', () => {
    expect(chunked([1, 2, 3], 1)).toEqual([[1], [2], [3]])
  })
})

describe('sleep', () => {
  it('resolves to undefined', async () => {
    await expect(sleep(1)).resolves.toBeUndefined()
  })

  it('does not resolve before the requested delay elapses', async () => {
    vi.useFakeTimers()
    try {
      let resolved = false
      const p = sleep(1000).then(() => {
        resolved = true
      })

      await vi.advanceTimersByTimeAsync(500)
      expect(resolved).toBe(false)

      await vi.advanceTimersByTimeAsync(500)
      await p
      expect(resolved).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
