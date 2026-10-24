import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function TextInput({ label, value, onChange, hint, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; type?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function TextArea({ label, value, onChange, hint, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; hint?: ReactNode; rows?: number }) {
  return (
    <Field label={label} hint={hint}>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function Select({ label, value, onChange, options, hint }: { label?: string; value: string; onChange: (v: string) => void; options: [string, string][]; hint?: ReactNode }) {
  const control = (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
  return label ? (
    <Field label={label} hint={hint}>
      {control}
    </Field>
  ) : (
    control
  )
}

export function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="ed-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export function Btn({ children, onClick, kind = 'secondary', disabled, title }: { children: ReactNode; onClick: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={`ed-btn ${kind}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}
