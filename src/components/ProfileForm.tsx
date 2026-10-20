import type { InputHTMLAttributes, ReactNode } from 'react'
import { allFormFields } from '../data/formFields'
import { personName, type Profile } from '../types'

interface Props {
  profile: Profile
  onChange: (p: Profile) => void
  onDone: () => void
}

export function ProfileForm({ profile, onChange, onDone }: Props) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => onChange({ ...profile, [key]: value })
  const filled = allFormFields.filter((k) => String(profile[k]).trim()).length
  const total = allFormFields.length

  const text = (key: keyof Profile, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}, hint?: ReactNode) => (
    <label className="field">
      <span>{label}</span>
      <input id={`p-${key}`} value={profile[key]} onChange={(e) => set(key, e.target.value as never)} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  )

  const choice = <K extends keyof Profile>(key: K, label: string, options: [Profile[K], string][]) => (
    <label className="field">
      <span>{label}</span>
      <select id={`p-${key}`} value={profile[key]} onChange={(e) => set(key, e.target.value as Profile[K])}>
        <option value="">Choose…</option>
        {options.map(([v, l]) => (
          <option key={l} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <form className="profile" onSubmit={(e) => e.preventDefault()} autoComplete="on">
      <div className="page-intro">
        <h2>{personName(profile) ? `My info: ${personName(profile)}` : 'My info'}</h2>
        <p>Enter this once and the site fills it into your forms. It saves automatically on this device as you type.</p>
        <div className="meter" aria-live="polite">
          <div className="bar" role="progressbar" aria-label="Details filled in" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={total}>
            <div style={{ width: `${(filled / total) * 100}%` }} />
          </div>
          <span>
            <strong>
              {filled} of {total}
            </strong>{' '}
            details the forms use
          </span>
        </div>
        <p className="callout neutral">Your Social Security Number isn’t kept here. Add it when you make your forms under “Forms to sign” (it’s never saved), or write it on the printed form by hand.</p>
      </div>

      <fieldset>
        <legend>Your name</legend>
        <p className="used-on">On every form</p>
        <div className="grid">
          {text('firstName', 'First name', { autoComplete: 'given-name' })}
          {text('middleName', 'Middle name', { autoComplete: 'additional-name' }, 'Optional')}
          {text('lastName', 'Last name', { autoComplete: 'family-name' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Where you serve</legend>
        <p className="used-on">On every form</p>
        <div className="grid">
          {text('siteName', 'Parish or school', { placeholder: 'St. Joseph' })}
          {text('siteCity', 'City', { placeholder: 'Bethlehem' })}
          {choice('locationType', 'Location type', [
            ['Parish', 'Parish'],
            ['School', 'School'],
            ['Both', 'Both'],
          ])}
          {choice('position', 'Your role', [
            ['Volunteer', 'Volunteer'],
            ['Employee', 'Employee'],
            ['Teacher', 'Teacher'],
            ['Contractor', 'Contractor'],
            ['Priest', 'Priest'],
            ['Religious', 'Religious'],
          ])}
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact and birth date</legend>
        <p className="used-on">On the Background Check Authorization and NSOR application</p>
        <div className="grid">
          {text('dob', 'Date of birth', { type: 'date', autoComplete: 'bday' })}
          {text('phone', 'Phone', { type: 'tel', autoComplete: 'tel', placeholder: '610-555-0123' })}
          {text('email', 'Email', { type: 'email', autoComplete: 'email' })}
        </div>
        <div className="grid address">
          {text('street', 'Street address', { autoComplete: 'address-line1' })}
          {text('apt', 'Apartment or unit', { autoComplete: 'address-line2' }, 'Optional')}
          {text('city', 'City', { autoComplete: 'address-level2' })}
          {text('state', 'State', { autoComplete: 'address-level1' })}
          {text('zip', 'ZIP code', { autoComplete: 'postal-code', inputMode: 'numeric' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Background check questions</legend>
        <p className="used-on">On the Background Check Authorization</p>
        <div className="grid">
          {choice('residedInPA', 'Lived in PA 1+ year?', [
            ['yes', 'Yes'],
            ['no', 'No'],
          ])}
          {choice('gender', 'Sex', [
            ['Female', 'Female'],
            ['Male', 'Male'],
          ])}
          {text('race', 'Race', {}, 'Optional')}
          {text('ueid', 'UEID', {}, 'Only if your coordinator gave you one')}
        </div>
      </fieldset>

      <div className="form-end">
        <button type="button" className="primary" onClick={onDone}>
          Back to my checklist
        </button>
        <span className="small">Saved on this device.</span>
      </div>
    </form>
  )
}
