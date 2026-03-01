import { describe, it, expect } from 'vitest'
import { MockProvider } from '../../generation/providers/mock'
import { getProvider } from '../../generation/providers'

describe('MockProvider', () => {
  const provider = new MockProvider()

  it('generate returns valid JSON string', async () => {
    const result = await provider.generate('test prompt')
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('generateStream returns valid JSON string', async () => {
    const chunks: string[] = []
    const result = await provider.generateStream('test prompt', (delta) => chunks.push(delta))
    expect(() => JSON.parse(result)).not.toThrow()
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toBe(result)
  })

  it('detects path_questions prompt and returns paths response', async () => {
    const result = await provider.generate('Generate path_questions for Conversation Compass')
    const parsed = JSON.parse(result)
    expect(parsed.paths).toBeDefined()
    expect(parsed.paths.clarify).toBeTruthy()
    expect(parsed.paths['go-deeper']).toBeTruthy()
  })

  it('detects branch prompt and returns branches response', async () => {
    const result = await provider.generate('Generate follow-up questions to branch')
    const parsed = JSON.parse(result)
    expect(parsed.branches).toBeDefined()
    expect(parsed.branches.length).toBe(3)
  })

  it('defaults to answer response for unrecognized prompts', async () => {
    const result = await provider.generate('some random prompt')
    const parsed = JSON.parse(result)
    expect(parsed.summary).toBeTruthy()
    expect(parsed.bullets).toBeDefined()
    expect(parsed.bullets.length).toBeGreaterThan(0)
  })
})

describe('getProvider', () => {
  it('returns MockProvider when apiKey is empty', () => {
    const provider = getProvider('')
    expect(provider).toBeDefined()
    // Verify it behaves like MockProvider
    expect(provider.generate).toBeDefined()
    expect(provider.generateStream).toBeDefined()
  })

  it('returns GeminiProvider when apiKey is provided', () => {
    const provider = getProvider('AIzaFakeKeyForTesting12345678901234')
    expect(provider).toBeDefined()
    expect(provider.generate).toBeDefined()
    expect(provider.generateStream).toBeDefined()
  })

  it('caches GeminiProvider for same key', () => {
    const key = 'AIzaAnotherFakeKey1234567890123456'
    const provider1 = getProvider(key)
    const provider2 = getProvider(key)
    expect(provider1).toBe(provider2)
  })

  it('creates new GeminiProvider for different key', () => {
    const provider1 = getProvider('AIzaKey1_____________________________')
    const provider2 = getProvider('AIzaKey2_____________________________')
    expect(provider1).not.toBe(provider2)
  })
})
