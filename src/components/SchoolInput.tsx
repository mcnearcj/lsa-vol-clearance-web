import { useState } from 'react'
import { matchSchools, type School } from '../data/schools'

interface Props {
  value: string
  onType: (name: string) => void
  onPick: (school: School) => void
}

// "Parish or school" box: suggests the diocese's schools by name, with each one's town, as the person types.
// Built by hand rather than with <datalist>, which some browsers also match on the town and show unevenly.
export function SchoolInput({ value, onType, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const matches = open ? matchSchools(value) : []
  const shown = matches.length > 0

  const pick = (s: School) => {
    onPick(s)
    setOpen(false)
  }

  return (
    <div className="field school-field">
      <label htmlFor="p-siteName">Parish or school</label>
      <div className="combo">
        <input
          id="p-siteName"
          role="combobox"
          aria-expanded={shown}
          aria-controls="school-list"
          aria-autocomplete="list"
          aria-activedescendant={shown ? `school-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onType(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!shown) return
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, matches.length - 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
            else if (e.key === 'Enter') pick(matches[Math.min(active, matches.length - 1)])
            else if (e.key === 'Escape') setOpen(false)
            else return
            e.preventDefault()
          }}
        />
        {shown && (
          <ul id="school-list" className="combo-list" role="listbox" aria-label="Diocesan schools">
            {matches.map((s, i) => (
              <li
                key={s.name}
                id={`school-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                // mousedown, not click, so it lands before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(s)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{s.name}</span>
                <small>{s.city}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
      <small>Start typing a diocesan school to pick it, or type your parish.</small>
    </div>
  )
}
