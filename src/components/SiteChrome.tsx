import type { ReactNode } from 'react'
import { site } from '../data/site'
import { formatDate } from '../dates'

// The page header, title and footer, laid out like the school's own website so the two feel like one place.
// The crest, address and links all come from the school's settings, and each is left out when blank.

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>

function Logo({ className }: { className: string }) {
  if (!site.logoUrl) return null
  // The image lives on the school's site. If it can't load, the name beside it still tells people where they are.
  return <img className={className} src={site.logoUrl} alt="" onError={(e) => (e.currentTarget.hidden = true)} />
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  const brand = (
    <>
      <Logo className="brand-logo" />
      <span className="brand-text">
        <span className="brand-name">{site.schoolName}</span>
        {site.tagline && <span className="brand-tag">{site.tagline}</span>}
      </span>
    </>
  )
  return (
    <header className="sitehead">
      <div className="sitehead-top inner">
        {site.homeUrl ? (
          <a className="brand" href={site.homeUrl} target="_blank" rel="noreferrer noopener">
            {brand}
            {NEW_TAB}
          </a>
        ) : (
          <div className="brand">{brand}</div>
        )}
        {site.homeUrl && (
          <a className="outline-btn" href={site.homeUrl} target="_blank" rel="noreferrer noopener">
            School website
            {NEW_TAB}
          </a>
        )}
      </div>
      {children}
    </header>
  )
}

/** The breadcrumb and big page title, like the school's inner pages. */
export function PageHead() {
  return (
    <div className="pagehead">
      {site.homeUrl && (
        <nav aria-label="Breadcrumb" className="crumbs">
          <a href={site.homeUrl} target="_blank" rel="noreferrer noopener">
            Home
            {NEW_TAB}
          </a>
          <span aria-hidden> › </span>
          <span aria-current="page">Volunteer Clearances</span>
        </nav>
      )}
      <h1>Volunteer Clearances</h1>
    </div>
  )
}

export function SiteFooter() {
  const link = (href: string, label: string) =>
    href && (
      <li>
        <a href={href} target="_blank" rel="noreferrer noopener">
          {label}
          {NEW_TAB}
        </a>
      </li>
    )
  return (
    <footer className="sitefoot">
      <div className="sitefoot-main inner">
        <div className="foot-brand">
          <Logo className="foot-logo" />
          {site.address && <span>{site.address}</span>}
          {site.phone && <a href={`tel:${site.phone.replace(/[^0-9+]/g, '')}`}>{site.phone}</a>}
        </div>
        <ul className="foot-links">
          {link(site.homeUrl, `${site.schoolName} website`)}
          {link(site.requirementsUrl, 'Diocese Safe Environment requirements')}
          {link(site.policiesUrl, 'Diocese Safe Environment policies')}
        </ul>
        <p className="foot-note">
          Not an official Diocese of Allentown website. Policies and forms from the diocese’s{' '}
          <a href={site.policiesUrl} target="_blank" rel="noreferrer noopener">
            Safe Environment Policies page
          </a>
          ; requirements from its{' '}
          <a href={site.requirementsUrl} target="_blank" rel="noreferrer noopener">
            {site.checklistName}
          </a>
          , revised {site.checklistRevised}.{site.checkedOn ? ` Compared with those pages on ${formatDate(site.checkedOn)}.` : ''} Check them for anything newer.
        </p>
      </div>
    </footer>
  )
}
