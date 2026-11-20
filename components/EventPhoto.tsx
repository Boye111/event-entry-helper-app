/**
 * Event photo or flyer on invite pages, shown whole at its real shape (never cropped, so flyer
 * text stays readable). Renders nothing when the event has no photo.
 */
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/photo/${publicId}?v=${version}`}
      alt={alt}
      className={`mx-auto block h-auto w-auto max-w-full rounded-2xl shadow-sm ring-1 ring-gold/40 ${className}`}
    />
  );
}
