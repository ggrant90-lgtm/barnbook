import ReactMarkdown from "react-markdown";
import Link from "next/link";
import Image from "next/image";

export function LegalPage({
  content,
  version,
}: {
  content: string;
  version: string;
}) {
  return (
    <div className="min-h-screen bg-parchment">
      {/* Header */}
      <header className="border-b border-barn-dark/10 bg-white/80 px-4 py-3 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-serif text-lg font-semibold text-barn-dark no-underline"
          >
            <Image
              src="/logo.png"
              alt="BarnBook"
              width={32}
              height={32}
              className="rounded-lg"
            />
            BarnBook
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/signin"
              className="text-sm text-barn-dark/60 hover:text-brass-gold"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream hover:bg-forest-deep transition"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
        <div className="mb-6">
          <span className="text-xs font-medium text-brass-gold">
            Version {version}
          </span>
        </div>

        <article className="legal-content prose prose-slate max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="font-serif text-3xl font-bold text-barn-dark mb-6 mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-serif text-xl font-semibold text-barn-dark mt-10 mb-4 border-b border-barn-dark/10 pb-2">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-serif text-lg font-semibold text-barn-dark mt-6 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-barn-dark/80 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="text-barn-dark/80 leading-relaxed mb-4 space-y-2 pl-6 list-disc">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="text-barn-dark/80">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-barn-dark">
                  {children}
                </strong>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-brass-gold hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-brass-gold/40 bg-brass-gold/5 pl-4 py-3 my-6 rounded-r-lg text-sm text-barn-dark/70 italic">
                  {children}
                </blockquote>
              ),
              hr: () => (
                <hr className="my-8 border-barn-dark/10" />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-barn-dark/10 px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 text-xs text-barn-dark/40">
          <span>&copy; 2026 BarnBook. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-brass-gold transition">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-brass-gold transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
