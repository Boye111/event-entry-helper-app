/** Arched event photo used on invite pages. Renders nothing when the event has no photo. */
export function EventPhoto({
  publicId,
  version,
  alt,
  className = "",
}: {
  publicId: string;
  version: string | null;
  alt: string;
  className?: string;
}) {
  if (!version) return null;
  return (
    <div
      className={`mx-auto overflow-hidden rounded-t-full ring-1 ring-gold/40 ring-offset-4 ring-offset-ivory shadow-sm ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photo/${publicId}?v=${version}`} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}
