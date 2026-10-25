/**
 * PandaPayLens mascot: an original geometric panda wearing a magnifying lens.
 * Decorative unless a title is supplied.
 */
export function PandaMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {/* ears */}
      <circle cx="15" cy="15" r="9" fill="#16181d" />
      <circle cx="49" cy="15" r="9" fill="#16181d" />
      {/* head */}
      <circle cx="32" cy="34" r="24" fill="#ffffff" stroke="#16181d" strokeWidth="2.5" />
      {/* eye patches */}
      <ellipse cx="22" cy="31" rx="7" ry="8.5" transform="rotate(-18 22 31)" fill="#16181d" />
      <ellipse cx="42" cy="31" rx="7" ry="8.5" transform="rotate(18 42 31)" fill="#16181d" />
      {/* eyes */}
      <circle cx="23" cy="31" r="2.6" fill="#ffffff" />
      {/* lens over the right eye */}
      <circle
        cx="42"
        cy="31"
        r="9.5"
        fill="#3fcf8e"
        fillOpacity="0.28"
        stroke="#0f7a4f"
        strokeWidth="2.6"
      />
      <circle cx="42" cy="31" r="2.6" fill="#ffffff" />
      <path d="M48.8 37.8 L56 45" stroke="#0f7a4f" strokeWidth="3.4" strokeLinecap="round" />
      {/* nose and mouth */}
      <ellipse cx="32" cy="42" rx="3.4" ry="2.4" fill="#16181d" />
      <path
        d="M28.5 46.5 Q32 49.5 35.5 46.5"
        stroke="#16181d"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
