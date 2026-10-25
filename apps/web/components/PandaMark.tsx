/**
 * PandaPayLens logo: a panda looking through a magnifying lens at a chart.
 * Same artwork as app/icon.svg and docs/logo.svg. Decorative unless a title is supplied.
 */
export function PandaMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={(size * 1040) / 1140}
      viewBox="60 120 1140 1040"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <circle className="panda-ear" cx="275" cy="335" r="190" fill="#141414" />
      <circle className="panda-ear" cx="980" cy="335" r="190" fill="#141414" />
      <path
        d="M165 405 A128 128 0 0 1 345 232"
        stroke="#3a3a3a"
        strokeWidth="34"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M1090 405 A128 128 0 0 0 910 232"
        stroke="#3a3a3a"
        strokeWidth="34"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M155 770 C155 440 375 240 632 240 C890 240 1110 440 1110 770 C1110 1015 905 1115 632 1115 C360 1115 155 1015 155 770 Z"
        fill="#ffffff"
        stroke="#111111"
        strokeWidth="28"
      />
      <ellipse cx="378" cy="668" rx="182" ry="140" transform="rotate(-38 378 668)" fill="#111111" />
      <circle cx="405" cy="685" r="64" fill="#ffffff" />
      <circle cx="425" cy="680" r="50" fill="#111111" />
      <circle cx="452" cy="650" r="17" fill="#ffffff" />
      <path d="M1020 800 L1135 925" stroke="#111111" strokeWidth="86" strokeLinecap="round" />
      <path d="M1060 850 L1128 922" stroke="#3a3a3a" strokeWidth="22" strokeLinecap="round" />
      <path d="M990 770 L1040 825" stroke="#ffffff" strokeWidth="44" />
      <path
        d="M968 760 L1012 718 M1018 836 L1062 794"
        stroke="#111111"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <circle cx="835" cy="655" r="228" fill="#111111" />
      <circle cx="835" cy="655" r="196" fill="#ffffff" />
      <circle cx="835" cy="655" r="172" fill="#111111" />
      <path
        d="M720 610 A125 125 0 0 1 795 545"
        stroke="#ffffff"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <polyline
        points="735,710 795,663 855,690 912,605"
        fill="none"
        stroke="#1ed47e"
        strokeWidth="22"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="735" cy="710" r="22" fill="#1ed47e" />
      <circle cx="795" cy="663" r="22" fill="#1ed47e" />
      <circle cx="855" cy="690" r="22" fill="#1ed47e" />
      <circle cx="915" cy="602" r="28" fill="#1ed47e" />
      <path d="M522 818 Q585 790 652 818 Q646 868 588 888 Q530 868 522 818 Z" fill="#111111" />
      <path
        d="M462 885 Q470 945 525 948 Q570 948 590 902 Q610 948 655 948 Q712 945 728 885"
        fill="none"
        stroke="#111111"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
