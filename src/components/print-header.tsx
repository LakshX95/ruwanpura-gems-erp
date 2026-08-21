/**
 * Only appears on paper. A printed stock-take sheet or custody list has to say
 * what it is and when it was run, or it is worthless as a record a week later.
 */
export function PrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="print-only mb-3 border-b border-line pb-2">
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold text-fg">Ruwanpura Gems</h1>
        <span className="text-xs text-fg-3">
          {new Date().toLocaleString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm text-fg-2">
        {title}
        {subtitle ? ` — ${subtitle}` : ""}
      </p>
    </div>
  );
}
