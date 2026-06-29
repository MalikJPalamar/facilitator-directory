"use client";

/**
 * A submit button that guards destructive webhook actions behind a
 * `window.confirm(...)` step, so Delete and Rotate-secret can't fire on a single
 * stray click. It lives inside its parent `<form action={…}>`; on confirm it
 * lets the native submit proceed, on cancel it prevents it. Kept co-located with
 * the webhooks console (not in shared _components) since the confirm copy is
 * specific to these flows. Style via `className` like any other button.
 */
export function ConfirmSubmit({
  message,
  children,
  className = "btn btn-sm",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
