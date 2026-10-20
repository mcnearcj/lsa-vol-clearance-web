import type { Profile } from '../types'

interface Props {
  profile: Profile
  onChange: (p: Profile) => void
}

export function ProfileForm({ profile, onChange }: Props) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => onChange({ ...profile, [key]: value })
  const text = (key: keyof Profile, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      <span>{label}</span>
      <input value={profile[key]} onChange={(e) => set(key, e.target.value as never)} {...props} />
    </label>
  )

  return (
    <form className="profile" onSubmit={(e) => e.preventDefault()} autoComplete="on">
      <p className="privacy-note">
        This information is saved only in this browser and is used to pre-fill your forms. It is never sent anywhere. Do not enter your Social Security Number; the forms leave that blank for you to write by hand.
      </p>

      <fieldset>
        <legend>You</legend>
        <div className="grid">
          {text('firstName', 'First name', { autoComplete: 'given-name' })}
          {text('middleName', 'Middle name', { autoComplete: 'additional-name' })}
          {text('lastName', 'Last name', { autoComplete: 'family-name' })}
          {text('dob', 'Date of birth', { type: 'date', autoComplete: 'bday' })}
          <label className="field">
            <span>Gender (as on form)</span>
            <select value={profile.gender} onChange={(e) => set('gender', e.target.value as Profile['gender'])}>
              <option value="">Leave blank</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          {text('race', 'Race (optional)')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact</legend>
        <div className="grid">
          {text('street', 'Street address', { autoComplete: 'address-line1' })}
          {text('apt', 'Apartment / unit', { autoComplete: 'address-line2' })}
          {text('city', 'City', { autoComplete: 'address-level2' })}
          {text('state', 'State', { autoComplete: 'address-level1' })}
          {text('zip', 'ZIP code', { autoComplete: 'postal-code', inputMode: 'numeric' })}
          {text('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
          {text('email', 'Email', { type: 'email', autoComplete: 'email' })}
        </div>
        <label className="field inline">
          <span>Have you lived in Pennsylvania for more than a year?</span>
          <select value={profile.residedInPA} onChange={(e) => set('residedInPA', e.target.value as Profile['residedInPA'])}>
            <option value="">Leave blank</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Where you serve</legend>
        <div className="grid">
          {text('siteName', 'Parish / school name (e.g. St. Joseph)')}
          {text('siteCity', 'City (e.g. Bethlehem)')}
          <label className="field">
            <span>Location type</span>
            <select value={profile.locationType} onChange={(e) => set('locationType', e.target.value as Profile['locationType'])}>
              <option value="">Leave blank</option>
              <option>Parish</option>
              <option>School</option>
              <option>Both</option>
            </select>
          </label>
          <label className="field">
            <span>Diocesan position</span>
            <select value={profile.position} onChange={(e) => set('position', e.target.value as Profile['position'])}>
              <option value="">Leave blank</option>
              {['Volunteer', 'Employee', 'Teacher', 'Contractor', 'Priest', 'Religious'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          {text('ueid', 'UEID (if your coordinator gave you one)')}
        </div>
      </fieldset>
    </form>
  )
}
