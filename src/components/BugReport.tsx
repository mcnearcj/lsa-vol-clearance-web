import { useState } from 'react'
import { cloudConfigured, getClient } from '../cloud/client'

const REPO_ISSUES = 'https://github.com/mcnearcj/lsa-vol-clearance-web/issues/new'

interface Props {
  /** Which part of the site the person was using, attached to the report. */
  page: string
}

function context(page: string) {
  return {
    page,
    browser: navigator.userAgent.slice(0, 500),
    screen: `${window.innerWidth}x${window.innerHeight}`,
  }
}

function githubIssueUrl(message: string, page: string) {
  const c = context(page)
  const body = `${message}\n\n---\nPage: ${c.page}\nBrowser: ${c.browser}\nScreen: ${c.screen}`
  return `${REPO_ISSUES}?title=${encodeURIComponent('Bug report: ' + message.slice(0, 60))}&body=${encodeURIComponent(body)}`
}

export function BugReport({ page }: Props) {
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const submit = async () => {
    if (!cloudConfigured) {
      setState('failed')
      return
    }
    setState('sending')
    try {
      const c = await getClient()
      const { error } = await c.from('bug_reports').insert({ message: message.trim(), contact: contact.trim() || null, ...context(page) })
      if (error) throw error
      setState('sent')
      setMessage('')
      setContact('')
    } catch {
      setState('failed')
    }
  }

  if (state === 'sent') {
    return (
      <div className="stack">
        <p className="notice ok" role="status">
          Thanks, your report was sent.
        </p>
        <div className="row">
          <button className="ghost" onClick={() => setState('idle')}>
            Report something else
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="stack bug-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className="field">
        <span>What went wrong?</span>
        <textarea
          id="bug-message"
          rows={4}
          minLength={5}
          maxLength={4000}
          required
          placeholder="What you were doing, what you expected, and what happened instead."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <small>Please don’t include personal details like your address, birth date or Social Security Number.</small>
      </label>
      <label className="field">
        <span>Your email</span>
        <input id="bug-contact" type="email" maxLength={200} autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} />
        <small>Optional. Only if you’d like a reply.</small>
      </label>
      <p className="small">Your browser type and screen size are included to help track down the problem.</p>
      <div className="row">
        <button className="primary" type="submit" disabled={state === 'sending' || message.trim().length < 5}>
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
      {state === 'failed' && (
        <p className="notice bad" role="alert">
          The report couldn’t be sent from here.{' '}
          <a href={githubIssueUrl(message, page)} target="_blank" rel="noreferrer noopener">
            Report it on GitHub instead
          </a>{' '}
          (needs a free GitHub account), or tell your coordinator.
        </p>
      )}
    </form>
  )
}
