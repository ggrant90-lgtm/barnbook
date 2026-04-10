"use client";

export function UpgradeModal({
  barnName,
  onClose,
}: {
  barnName: string;
  barnId?: string;
  currentCapacity?: number;
  isAddition?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-barn-dark/40 hover:bg-barn-dark/5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Homestead icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brass-gold/15">
          <svg className="h-8 w-8 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </div>

        <h2 className="text-center font-serif text-2xl font-semibold text-barn-dark">
          Welcome to Homestead Territory!
        </h2>

        <div className="mt-4 rounded-xl border border-brass-gold/30 bg-brass-gold/10 p-4">
          <p className="text-center text-sm text-barn-dark/80 leading-relaxed">
            You will <strong className="text-barn-dark">NEVER</strong> be charged for anything you build.
          </p>
          <p className="mt-2 text-center text-xs font-semibold text-brass-gold uppercase tracking-wide">
            Limited Time Only!
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-barn-dark/50 leading-relaxed">
          Add as many horses as you need to <strong>{barnName}</strong>.
          Everything you create during the Homestead period is yours to keep — forever.
        </p>

        <button
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brass-gold px-4 py-3.5 font-medium text-barn-dark shadow transition hover:brightness-110"
        >
          Keep Building
        </button>
      </div>
    </div>
  );
}
