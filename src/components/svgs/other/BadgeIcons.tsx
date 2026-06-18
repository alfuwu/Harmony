import React from "react";

export type BadgeIconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function BadgeIcon({
  size = 16,
  children,
  ...props
}: BadgeIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      aria-hidden="true"
      role="img"
      {...props}
    >
      {children}
    </svg>
  );
}

export function EarlyAdopterIcon({ size = 16, ...props }: BadgeIconProps) {
  return (
    <BadgeIcon size={size} {...props}>
      <defs>
        <linearGradient id="eaa" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0"   />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.85"/>
        </linearGradient>
        <radialGradient id="eab" cx="38%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="28%" stopColor="#FDE68A" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </radialGradient>
      </defs>
      <polygon points="1,22 4,19.5 12.5,11 10,13" fill={`url(#$eaa)`} />
      <polygon points="2.5,23.5 5.5,21 12.5,12 11,14.5" fill="url(#eaa)" opacity="0.4"/>
      <polygon
        points="15,1.5 16.7,6.3 21,8 16.7,9.7 15,14.5 13.3,9.7 9,8 13.3,6.3"
        fill="url(#eab)"
      />
      <circle cx="15" cy="8" r="1.8" fill="white" opacity="0.55" />
      <polygon
        points="5,17 5.5,18.6 7,19 5.5,19.4 5,21 4.5,19.4 3,19 4.5,18.6"
        fill="#FDE68A" opacity="0.65"
      />
    </BadgeIcon>
  );
}

export function ActiveContributorIcon({ size = 16, ...props }: BadgeIconProps) {
  return (
    <BadgeIcon size={size} {...props}>
      <defs>
        <linearGradient id="aca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id="acb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="45%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <path d="M 5.5 4 L 18.5 4 L 14.5 13.5 L 9.5 13.5 Z" fill="url(#aca)" />
      <path d="M 7.5 5.5 L 16.5 5.5 L 14 13 L 10 13 Z" fill="#120802" opacity="0.8" />
      <path d="M 12 13.5 C 8.5 11 9 7 12 5 C 15 7 15.5 11 12 13.5 Z" fill="url(#acb)" />
      <path d="M 12 12.5 C 10.5 10.5 11 8 12 7 C 13 8 13.5 10.5 12 12.5 Z" fill="#FFFBEB" />
      <circle cx="12" cy="9" r="0.7" fill="white" opacity="0.8" />
      <ellipse cx="12" cy="4" rx="6.5" ry="1.5" fill="#FEF3C7" />
      <ellipse cx="12" cy="4" rx="5" ry="1" fill="#1C0803" />
      <rect x="10.5" y="13.5" width="3" height="3.5" rx="0.5" fill="url(#aca)" />
      <rect x="7" y="17" width="10" height="3.5" rx="2" fill={`url(#$aca)`} />
      <rect x="7" y="17" width="10" height="1.3" fill="white" opacity="0.12" />
    </BadgeIcon>
  );
}

export function BugReporterIcon({ size = 16, ...props }: BadgeIconProps) {
  return (
    <BadgeIcon size={size} {...props} >
      <defs>
        <linearGradient id="spa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#1E293B" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
        <linearGradient id="spb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0c1c35" />
          <stop offset="55%" stopColor="#11161f" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
      </defs>

      <g>
        <g transform="translate(0.000001 0.000001)">
          <path d="M8.774909,16.447059L5.470196,18.448566c-1.14.92,1.186566,1.936586.03291,5.287198c0,0-1.752144-4.941986-1.752144-4.941986-.14897-.788712.534299-1.684176,6.06-4.88L8.774909,16.447059Z" transform="translate(0.000001 0.02)" fill="url(#spb)" />
          <path d="M13.090962,16.087478c-2.512887.780774-2.729101.585375-7.210444,2.731716-1.244843.626777.884866,2.676584-.269556,5.408284c0,0-1.86-5.4337-1.86-5.4337-.06-1.2063,3.9112-3.507956,9.884713-4.027807l-.544713,1.321507Z" transform="translate(-3.460765 -1.958912)" fill="url(#spb)" />
        </g>
        <g transform="translate(0.000001 0)">
          <path d="M13.224382,14.462872c-1.766304,1.711957-3.56639,1.051515-6.772912,4.258037-.980238.980297,1.440217,3.233695-.13587,6.548913c0,0-1.983695-6.521739-1.983695-6.521739-.06-1.2063.983009-4.072541,6.956522-4.592392l1.935955.307181Z" transform="matrix(1 0 0 -1 -3.986995 27.375359)" fill="url(#spb)" />
          <path d="M12.429163,13.845191c-.565435,3.230023-2.95087,4.240046-2.805435,8.370023.048788,1.385448,3.154565.810023,5,3.98c0,0-6.994565-2.530023-6.994565-2.530023-.06-1.2063-.975015-4.861131,3.08-8.94l1.72-.88Z" transform="matrix(1 0 0 -1 -3.803857 26.226918)" fill="url(#spb)" />
        </g>
      </g>
      <g transform="matrix(-1 0 0 1 23.787254 0.106266)">
        <g transform="translate(0.000001 0.000001)">
          <path d="M8.774909,16.447059L5.470196,18.448566c-1.14.92,1.186566,1.936586.03291,5.287198c0,0-1.752144-4.941986-1.752144-4.941986-.14897-.788712.534299-1.684176,6.06-4.88L8.774909,16.447059Z" transform="translate(0.000001 0.02)" fill="url(#spb)" />
          <path d="M13.090962,16.087478c-2.512887.780774-2.729101.585375-7.210444,2.731716-1.244843.626777.884866,2.676584-.269556,5.408284c0,0-1.86-5.4337-1.86-5.4337-.06-1.2063,3.9112-3.507956,9.884713-4.027807l-.544713,1.321507Z" transform="translate(-3.460765 -1.958912)" fill="url(#spb)" />
        </g>
        <g transform="translate(0.000001 0)">
          <path d="M13.224382,14.462872c-1.766304,1.711957-3.56639,1.051515-6.772912,4.258037-.980238.980297,1.440217,3.233695-.13587,6.548913c0,0-1.983695-6.521739-1.983695-6.521739-.06-1.2063.983009-4.072541,6.956522-4.592392l1.935955.307181Z" transform="matrix(1 0 0 -1 -3.986995 27.375359)" fill="url(#spb)" />
          <path d="M12.429163,13.845191c-.565435,3.230023-2.95087,4.240046-2.805435,8.370023.048788,1.385448,3.154565.810023,5,3.98c0,0-6.994565-2.530023-6.994565-2.530023-.06-1.2063-.975015-4.861131,3.08-8.94l1.72-.88Z" transform="matrix(1 0 0 -1 -3.803857 26.226918)" fill="url(#spb)" />
        </g>
      </g>
      <g transform="translate(0.000001 0.000001)">
        <path d="M12,21.433219L8.141827,18.698664l2.13492-5.630517-2.704871-3.024711Q8.971396,5.85106,12,3.754872" fill="url(#spa)" strokeLinecap="round" />
        <path d="M12,21.433219L8.141827,18.698664l2.13492-5.630517-2.704871-3.024711Q8.971396,5.85106,12,3.754872" transform="matrix(-1 0 0 1 23.969999 0)" fill="url(#spa)" strokeLinecap="round" />
      </g>
    </BadgeIcon>
  );
}

export function StaffIcon({ size = 16, ...props }: any) {
  return (
    <img src="/icon.png" width={size} height={size} {...props} />
  );
}

export function VerifiedIcon({ size = 16, ...props }: BadgeIconProps) {
  return (
    <BadgeIcon size={size} {...props}>
      <defs>
        <linearGradient id={`va`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FAA" />
          <stop offset="50%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
      </defs>

      <path d={"M 2 3 L 22 3 L 22 13 C 22 19, 17 22, 12 23 C 7 22, 2 19, 2 13 Z"} fill={`url(#va)`} />

      <path
        d="M 3.5 4.5 L 20.5 4.5 L 20.5 13 C 20.5 18.5, 16 21.5, 12 22 C 8 21.5, 3.5 18.5, 3.5 13 Z"
        fill="none" stroke="white" strokeWidth="0.7" opacity="0.3"
      />

      <path
        d="M 2 3 L 22 3 L 22 8 C 16 5.5, 8 5.5, 2 8 Z"
        fill="white" opacity="0.2"
      />

      <polyline
        points="7.5,14 10.5,17 17,10.5"
        fill="none" stroke="black" strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <polyline
        points="7.5,14 10.5,17 17,10.5"
        fill="none" stroke="white" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </BadgeIcon>
  );
}

export function SupporterIcon({ size = 16, ...props }: BadgeIconProps) {
  return (
    <BadgeIcon size={size} {...props}>
      <defs>
        <linearGradient id="sra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDF2F8" />
          <stop offset="100%" stopColor="#FBCFE8" />
        </linearGradient>
        <linearGradient id="srb" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#9D174D" />
        </linearGradient>
        <linearGradient id="src" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="srd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      <polygon points="8,3.5 10,3.5 9,11 3,11" fill="url(#sra)" />
      <polygon points="10,3.5 14,3.5 15,11 9,11" fill="url(#sra)" />
      <polygon points="14,3.5 16,3.5 21,11 15,11" fill="url(#sra)" />
      <polygon points="8,3.5 10,3.5 9,11 3,11" fill="#F9A8D4" opacity="0.5"  />
      <polygon points="14,3.5 16,3.5 21,11 15,11" fill="#D8B4FE" opacity="0.42" />
      <polygon points="10.5,3.5 13.5,3.5 14,9 10,9" fill="white" opacity="0.32" />
      <polygon points="3,11 9,11 12,22" fill="url(#srb)" />
      <polygon points="9,11 15,11 12,22" fill="url(#src)" />
      <polygon points="15,11 21,11 12,22" fill="url(#srd)" />
      <line x1="8" y1="3.5" x2="9" y2="11" stroke="white" strokeWidth="0.5" opacity="0.3"  />
      <line x1="16" y1="3.5" x2="15" y2="11" stroke="white" strokeWidth="0.5" opacity="0.3"  />
      <line x1="10" y1="3.5" x2="9" y2="11" stroke="white" strokeWidth="0.5" opacity="0.22" />
      <line x1="14" y1="3.5" x2="15" y2="11" stroke="white" strokeWidth="0.5" opacity="0.22" />
      <line x1="3" y1="11" x2="21" y2="11" stroke="white" strokeWidth="0.6" opacity="0.4"  />
      <line x1="9" y1="11" x2="12" y2="22" stroke="white" strokeWidth="0.4" opacity="0.2"  />
      <line x1="15" y1="11" x2="12" y2="22" stroke="white" strokeWidth="0.4" opacity="0.2"  />
      <circle cx="9.5" cy="6.5" r="0.9" fill="white" opacity="0.9"  />
      <circle cx="8" cy="3.5" r="0.5" fill="white" opacity="0.55" />
      <circle cx="16" cy="3.5" r="0.5" fill="white" opacity="0.55" />
    </BadgeIcon>
  );
}

export const BADGE_ICONS: Record<number, React.ComponentType<BadgeIconProps>> = {
  0: EarlyAdopterIcon,
  1: ActiveContributorIcon,
  2: BugReporterIcon,
  3: StaffIcon,
  4: VerifiedIcon,
  5: SupporterIcon
};
