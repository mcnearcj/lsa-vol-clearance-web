import { faq } from '../data/faq'
import { builtInFieldsFor, customFields, fieldsUsedBy, formFields } from '../data/formFields'
import { FORMS, FORM_ORDER } from '../data/forms'
import { groups, orderedRequirements, requirements } from '../data/requirements'
import { site } from '../data/site'
import type { Content } from './schema'
import { contentApplied } from './useContent'

// The site's content lives in a few module-level lists and objects (checklist items, forms, school info…). Loading
// a school's content.json updates them in place before the page is drawn, so the rest of the code reads them as before.

/** The built-in settings as a Content, captured before anything is applied. */
export function currentContent(): Content {
  return structuredClone({
    version: 1 as const,
    school: { name: site.schoolName, tagline: site.tagline, homeUrl: site.homeUrl, logoUrl: site.logoUrl, address: site.address, phone: site.phone },
    lsec: site.lsec,
    diocese: site.diocese,
    checklist: {
      name: site.checklistName,
      revised: site.checklistRevised,
      file: site.checklistFile,
      requirementsUrl: site.requirementsUrl,
      limitedUrl: site.limitedChecklistUrl,
      policiesUrl: site.policiesUrl,
      checkedOn: site.checkedOn,
    },
    groups: [...groups],
    items: [...requirements],
    forms: [...FORMS],
    fields: [...customFields],
    faq: [...faq],
  })
}

export const defaultContent: Content = currentContent()

export function applyContent(c: Content): void {
  site.schoolName = c.school.name
  // The branding settings are optional; a settings file made before they existed keeps the built-in look.
  site.tagline = c.school.tagline ?? defaultContent.school.tagline ?? ''
  site.homeUrl = c.school.homeUrl ?? defaultContent.school.homeUrl ?? ''
  site.logoUrl = c.school.logoUrl ?? defaultContent.school.logoUrl ?? ''
  site.address = c.school.address ?? defaultContent.school.address ?? ''
  site.phone = c.school.phone ?? defaultContent.school.phone ?? ''
  site.lsec = { ...c.lsec }
  site.diocese = { ...site.diocese, ...c.diocese }
  site.checklistName = c.checklist.name
  site.checklistRevised = c.checklist.revised
  site.checklistFile = c.checklist.file
  site.requirementsUrl = c.checklist.requirementsUrl || site.requirementsUrl
  site.limitedChecklistUrl = c.checklist.limitedUrl || site.limitedChecklistUrl
  site.policiesUrl = c.checklist.policiesUrl || site.policiesUrl
  site.checkedOn = c.checklist.checkedOn

  groups.splice(0, groups.length, ...c.groups)
  requirements.splice(0, requirements.length, ...c.items)
  orderedRequirements.splice(0, orderedRequirements.length, ...groups.flatMap((g) => requirements.filter((r) => r.group === g.id)))
  FORMS.splice(0, FORMS.length, ...c.forms)
  FORM_ORDER.splice(0, FORM_ORDER.length, ...FORMS.map((f) => f.id))
  customFields.splice(0, customFields.length, ...c.fields)
  faq.splice(0, faq.length, ...c.faq)

  for (const k of Object.keys(formFields)) delete formFields[k]
  for (const f of FORMS) {
    if (f.kind === 'built-in') formFields[f.id] = builtInFieldsFor(f.id) ?? []
    else if (f.kind === 'fillable') formFields[f.id] = fieldsUsedBy(Object.values(f.mapping ?? {}))
    else if (f.kind === 'placed')
      formFields[f.id] = [...new Set([...fieldsUsedBy((f.placements ?? []).map((p) => p.source)), ...(f.placements ?? []).flatMap((p) => (p.when ? [p.when.field] : []))])]
    else formFields[f.id] = []
  }
  contentApplied()
}
