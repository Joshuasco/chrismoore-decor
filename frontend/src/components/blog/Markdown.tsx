import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders blog Markdown. Raw HTML in the source is NOT rendered
 * (react-markdown escapes it), so post content can't inject scripts.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href = "", children }) =>
          href.startsWith("/") ? (
            <Link href={href}>{children}</Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        // eslint-disable-next-line @next/next/no-img-element
        img: ({ src, alt }) => <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />,
        table: ({ children }) => (
          <div className="not-prose my-8 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:bg-cream [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold">
              {children}
            </table>
          </div>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
