import ReactMarkdown from 'react-markdown'

export default function Markdown({ children, className = '' }) {
  return (
    <div
      className={`prose prose-slate max-w-none prose-p:leading-relaxed prose-li:my-1 prose-headings:font-semibold ${className}`}
    >
      <ReactMarkdown>{children ?? ''}</ReactMarkdown>
    </div>
  )
}
