import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-8 sm:py-16">
      <main className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="space-y-3">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-parchment sm:text-5xl">
            BarnBook
          </h1>
          <p className="text-lg text-brass-gold sm:text-xl">
            Every horse. Every detail. One book.
          </p>
        </div>

        <div className="mt-10 space-y-3 text-base leading-relaxed text-muted-tan">
          <p>Identify horses from photos and keep every profile in one place.</p>
          <p>Log exercise, health, and farrier work without leaving the aisle.</p>
          <p>Built for barns — clear, fast, and easy on a phone.</p>
        </div>

        <div className="mt-12 flex w-full max-w-sm flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brass-gold px-6 py-3.5 text-center text-base font-medium text-barn-dark shadow-lg shadow-black/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            Sign Up
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 border-brass-gold/50 bg-barn-panel px-6 py-3.5 text-center text-base font-medium text-parchment transition hover:border-brass-gold hover:bg-barn-dark/80 active:scale-[0.99]"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
