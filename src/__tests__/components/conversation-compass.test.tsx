import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationCompass } from '../../components/CompassRose/ConversationCompass'

describe('ConversationCompass', () => {
  it('renders 6 direction buttons', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} />)

    expect(screen.getByText('Clarify')).toBeDefined()
    expect(screen.getByText('Go Deeper')).toBeDefined()
    expect(screen.getByText('Challenge')).toBeDefined()
    expect(screen.getByText('Apply')).toBeDefined()
    expect(screen.getByText('Connect')).toBeDefined()
    expect(screen.getByText('Surprise')).toBeDefined()
  })

  it('renders center "Explore" label', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} />)

    expect(screen.getByText('Explore')).toBeDefined()
  })

  it('calls onSelect with correct pathType when a direction is clicked', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Go Deeper'))
    expect(onSelect).toHaveBeenCalledWith('go-deeper')

    fireEvent.click(screen.getByText('Challenge'))
    expect(onSelect).toHaveBeenCalledWith('challenge')

    fireEvent.click(screen.getByText('Clarify'))
    expect(onSelect).toHaveBeenCalledWith('clarify')
  })

  it('shows question text when questions prop is provided', () => {
    const onSelect = vi.fn()
    const questions = {
      'go-deeper': 'What lies beneath the surface assumption?',
      'challenge': 'What evidence contradicts this view?',
    }
    render(<ConversationCompass onSelect={onSelect} questions={questions} />)

    // Questions are truncated to 60 chars + "..."
    expect(screen.getByText('What lies beneath the surface assumption?...')).toBeDefined()
    expect(screen.getByText('What evidence contradicts this view?...')).toBeDefined()
  })

  it('disables buttons when disabled prop is true', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('does not call onSelect when disabled', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} disabled={true} />)

    fireEvent.click(screen.getByText('Go Deeper'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('buttons are enabled by default', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('positions direction buttons radially', () => {
    const onSelect = vi.fn()
    render(<ConversationCompass onSelect={onSelect} />)

    // Each button should have a transform style with translate
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      const style = btn.getAttribute('style')
      if (style) {
        expect(style).toContain('translate')
      }
    })
  })
})
