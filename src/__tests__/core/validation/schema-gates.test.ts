import { describe, it, expect } from 'vitest'
import { validateOutput, parseJSON, parseAndValidate } from '../../../core/validation/schema-gates'

describe('validateOutput', () => {
  describe('answer job type', () => {
    it('passes for valid answer', () => {
      const result = validateOutput('answer', {
        summary: 'A valid summary here',
        bullets: ['Point one', 'Point two'],
      })
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('fails for missing summary', () => {
      const result = validateOutput('answer', {
        bullets: ['Point one'],
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.feedback).toContain('schema')
    })

    it('fails for empty bullets', () => {
      const result = validateOutput('answer', {
        summary: 'A summary',
        bullets: [],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('branch job type', () => {
    it('passes for valid branch response', () => {
      const result = validateOutput('branch', {
        questions: [
          { question: 'How does X work?', pathType: 'go-deeper' },
          { question: 'What if Y?', pathType: 'challenge' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('fails for empty questions array', () => {
      const result = validateOutput('branch', { questions: [] })
      expect(result.success).toBe(false)
    })

    it('fails for invalid pathType', () => {
      const result = validateOutput('branch', {
        questions: [{ question: 'Something', pathType: 'invalid' }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('dialogue_turn job type', () => {
    it('passes for valid dialogue turn', () => {
      const result = validateOutput('dialogue_turn', {
        content: 'But have you considered the alternative?',
        turnType: 'challenge',
        suggestedResponses: [
          { text: 'I see your point', intent: 'concede' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('passes without suggestedResponses (optional)', () => {
      const result = validateOutput('dialogue_turn', {
        content: 'Interesting perspective.',
        turnType: 'probe',
      })
      expect(result.success).toBe(true)
    })

    it('fails for invalid turnType', () => {
      const result = validateOutput('dialogue_turn', {
        content: 'Text',
        turnType: 'invalid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('lane_plan job type', () => {
    const validPlan = {
      goals: [{ heading: 'Goal 1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'quote', relevance: 'primary' }] }],
      assumptions: [{ heading: 'A1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'q', relevance: 'supporting' }] }],
      strategy: [{ heading: 'S1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'q', relevance: 'primary' }] }],
      milestones: [{ heading: 'M1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'q', relevance: 'primary' }] }],
      risks: [{ heading: 'R1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'q', relevance: 'primary' }] }],
      nextActions: [{ heading: 'N1', content: ['Detail'], evidence: [{ nodeId: '00000000-0000-4000-a000-000000000001', laneId: '00000000-0000-4000-a000-000000000002', quote: 'q', relevance: 'primary' }] }],
    }

    it('passes for valid structured plan', () => {
      const result = validateOutput('lane_plan', validPlan)
      expect(result.success).toBe(true)
    })

    it('fails for missing sections', () => {
      const result = validateOutput('lane_plan', { goals: validPlan.goals })
      expect(result.success).toBe(false)
    })
  })

  describe('path_questions job type', () => {
    it('passes for valid path questions', () => {
      const result = validateOutput('path_questions', {
        questions: [
          { question: 'Clarify this', pathType: 'clarify' },
          { question: 'Go deeper', pathType: 'go-deeper' },
        ],
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    const result = parseJSON('{"key": "value"}')
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ key: 'value' })
  })

  it('fails for invalid JSON', () => {
    const result = parseJSON('{broken')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('fails for empty string', () => {
    const result = parseJSON('')
    expect(result.success).toBe(false)
  })
})

describe('parseAndValidate', () => {
  it('parses and validates in one step', () => {
    const raw = JSON.stringify({
      summary: 'Valid summary',
      bullets: ['Bullet 1'],
    })
    const result = parseAndValidate('answer', raw)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  it('returns JSON parse error for invalid JSON', () => {
    const result = parseAndValidate('answer', 'not json')
    expect(result.success).toBe(false)
    expect(result.feedback).toContain('not valid JSON')
  })

  it('returns schema error for valid JSON but wrong shape', () => {
    const result = parseAndValidate('answer', '{"wrong": "shape"}')
    expect(result.success).toBe(false)
    expect(result.feedback).toContain('schema')
  })
})
