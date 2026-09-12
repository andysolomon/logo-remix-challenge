import { forwardRef, useId, useState, type KeyboardEvent } from 'react'
import { fullName, suggestTeams, type Team } from '../lib/teams'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Runs after the suggestion list has had its say (Enter on a highlighted pick is swallowed). */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  placeholder: string
  ariaLabel: string
  enterKeyHint: 'go' | 'next'
  readOnly?: boolean
}

/**
 * Guess field with team-name autocomplete. Grading is an exact name match, so the
 * list is there to save the player from spelling — arrow keys or a tap fill it in.
 * Suggestions sit above the field, where a phone keyboard can't cover them.
 */
export const GuessInput = forwardRef<HTMLInputElement, Props>(function GuessInput(
  { value, onChange, onKeyDown, placeholder, ariaLabel, enterKeyHint, readOnly = false },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const picks = open && !readOnly ? suggestTeams(value) : []

  const pick = (t: Team) => {
    onChange(fullName(t))
    setOpen(false)
    setActive(-1)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (picks.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (i + 1) % picks.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i - 1 + picks.length) % picks.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
        return
      }
      if (e.key === 'Enter' && active >= 0) {
        e.preventDefault()
        pick(picks[active])
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="guess-ac">
      <input
        ref={ref}
        className="guess-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKey}
        onBlur={() => setOpen(false)}
        readOnly={readOnly}
        placeholder={placeholder}
        // Native keyboards keep their own suggestion strip; ours only adds team names.
        autoComplete="off"
        autoCorrect="on"
        autoCapitalize="words"
        enterKeyHint={enterKeyHint}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={picks.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && picks[active] ? `${listId}-${active}` : undefined}
      />
      {picks.length > 0 && (
        <ul className="guess-suggest" id={listId} role="listbox" aria-label="Team suggestions">
          {picks.map((t, i) => (
            <li
              key={t.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`guess-suggest-item${i === active ? ' active' : ''}`}
              // Pointer-down would blur the field first; holding focus keeps typing alive.
              onPointerDown={(e) => {
                e.preventDefault()
                pick(t)
              }}
            >
              <span className="guess-suggest-name">{fullName(t)}</span>
              <span className="guess-suggest-tag">{t.conference}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
