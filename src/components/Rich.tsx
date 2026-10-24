import { parseRich } from '../content/text'

/** Shows school-written text: paragraphs, **bold** and [links](https://…), with {lsec}-style placeholders filled in. */
export function Rich({ text, inline = false }: { text: string; inline?: boolean }) {
  const paras = parseRich(text)
  const render = (p: ReturnType<typeof parseRich>[number]) =>
    p.map((piece, i) =>
      piece.type === 'bold' ? (
        <strong key={i}>{piece.text}</strong>
      ) : piece.type === 'link' ? (
        <a key={i} href={piece.href} target="_blank" rel="noreferrer noopener">
          {piece.text}
        </a>
      ) : (
        <span key={i}>{piece.text}</span>
      ),
    )
  if (inline) return <>{paras.map((p, i) => <span key={i}>{i > 0 && ' '}{render(p)}</span>)}</>
  return <>{paras.map((p, i) => <p key={i}>{render(p)}</p>)}</>
}
