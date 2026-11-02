import { memo } from "react";

export const LogoConstellation = memo(function LogoConstellation() {
  return (
    <div className="logo-constellation" aria-hidden="true">
      <div className="logo-constellation-spin">
        <svg
          viewBox="0 0 76 76"
          className="logo-constellation-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient
              id="constellation-nebula"
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.25" />
              <stop offset="40%" stopColor="#00e5ff" stopOpacity="0.14" />
              <stop offset="75%" stopColor="#ffd700" stopOpacity="0.06" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft cosmic nebula aura directly behind emblem */}
          <circle cx="38" cy="38" r="32" fill="url(#constellation-nebula)" />

          {/* Constellation Connecting Lines */}
          <g className="constellation-lines">
            {/* Outer constellation perimeter */}
            <line x1="16" y1="19" x2="38" y2="7" />
            <line x1="38" y1="7" x2="52" y2="24" />
            <line x1="52" y1="24" x2="61" y2="15" />
            <line x1="61" y1="15" x2="69" y2="33" />
            <line x1="69" y1="33" x2="63" y2="54" />
            <line x1="63" y1="54" x2="41" y2="69" />
            <line x1="41" y1="69" x2="25" y2="48" />
            <line x1="25" y1="48" x2="17" y2="63" />
            <line x1="17" y1="63" x2="7" y2="39" />
            <line x1="7" y1="39" x2="16" y2="19" />

            {/* Inner celestial geometry */}
            <line x1="16" y1="19" x2="52" y2="24" strokeDasharray="3 3" />
            <line x1="25" y1="48" x2="63" y2="54" strokeDasharray="3 3" />
            <line x1="38" y1="7" x2="41" y2="69" strokeDasharray="2 4" />
          </g>

          {/* Star Nodes (Points of light) */}
          <g className="constellation-stars">
            {/* Major 4-point sparkle stars */}
            {/* Star Alpha - North Star (38, 7) */}
            <path
              className="constellation-star sparkle twinkle-1"
              d="M 38 2 Q 38 7 43 7 Q 38 7 38 12 Q 38 7 33 7 Q 38 7 38 2 Z"
            />
            <circle cx="38" cy="7" r="1.3" className="constellation-core twinkle-1" />

            {/* Star Beta - North East (61, 15) */}
            <path
              className="constellation-star sparkle twinkle-2"
              d="M 61 11 Q 61 15 65 15 Q 61 15 61 19 Q 61 15 57 15 Q 61 15 61 11 Z"
            />
            <circle cx="61" cy="15" r="1.2" className="constellation-core twinkle-2" />

            {/* Star Gamma - South East (63, 54) */}
            <path
              className="constellation-star sparkle twinkle-3"
              d="M 63 50.5 Q 63 54 66.5 54 Q 63 54 63 57.5 Q 63 54 59.5 54 Q 63 54 63 50.5 Z"
            />
            <circle cx="63" cy="54" r="1.2" className="constellation-core twinkle-3" />

            {/* Star Delta - North West (16, 19) */}
            <path
              className="constellation-star sparkle twinkle-4"
              d="M 16 15 Q 16 19 20 19 Q 16 19 16 23 Q 16 19 12 19 Q 16 19 16 15 Z"
            />
            <circle cx="16" cy="19" r="1.3" className="constellation-core twinkle-4" />

            {/* Spherical Star Nodes */}
            <circle cx="69" cy="33" r="1.8" className="constellation-star cyan twinkle-2" />
            <circle cx="41" cy="69" r="1.9" className="constellation-star gold twinkle-1" />
            <circle cx="17" cy="63" r="1.7" className="constellation-star cyan twinkle-3" />
            <circle cx="7" cy="39" r="1.8" className="constellation-star twinkle-4" />
            <circle cx="52" cy="24" r="1.4" className="constellation-star gold twinkle-2" />
            <circle cx="25" cy="48" r="1.4" className="constellation-star cyan twinkle-1" />

            {/* Micro stardust */}
            <circle cx="28" cy="11" r="0.8" className="constellation-star micro twinkle-3" />
            <circle cx="67" cy="45" r="0.8" className="constellation-star micro twinkle-1" />
            <circle cx="51" cy="65" r="0.9" className="constellation-star micro twinkle-4" />
            <circle cx="10" cy="27" r="0.8" className="constellation-star micro twinkle-2" />
            <circle cx="23" cy="67" r="0.8" className="constellation-star micro twinkle-3" />
          </g>
        </svg>
      </div>
    </div>
  );
});

