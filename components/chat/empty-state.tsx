export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <div>
        <h3 className="text-md font-semibold text-slate-800">
          How can I help?
        </h3>
        <p className="text-sm text-slate-500">
          Ask about LaTeX or select text & press ⌘B to improve.
        </p>
      </div>
    </div>
  );
}

