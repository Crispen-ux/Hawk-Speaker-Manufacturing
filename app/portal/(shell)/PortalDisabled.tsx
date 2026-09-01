export default function PortalDisabled() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-8">
      <div className="max-w-md rounded-lg border border-rule bg-white p-8 text-center">
        <h1 className="font-display text-xl font-extrabold text-navy">Client portal unavailable</h1>
        <p className="mt-3 text-sm text-ink-soft">
          The client portal has been switched off by the company. Please contact them directly.
        </p>
      </div>
    </div>
  );
}