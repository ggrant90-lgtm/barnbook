import { Suspense } from "react";
import { JoinForm } from "./JoinForm";

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="px-6 py-16 text-center text-muted-tan">Loading…</div>}>
      <JoinForm />
    </Suspense>
  );
}
