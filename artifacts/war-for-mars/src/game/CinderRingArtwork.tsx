export function CinderRingArtwork() {
  return (
    <svg
      data-testid="artwork-cinder-ring-station"
      role="img"
      aria-label="Cinder Ring asteroid arena with orbital station, docks, and USSF and Accord traffic"
      viewBox="0 0 1200 360"
      className="block w-full border border-bone/10 bg-[#080b12]"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="cinder-space" x2="0" y2="1">
          <stop stopColor="#111827" />
          <stop offset="1" stopColor="#080a0f" />
        </linearGradient>
        <linearGradient id="cinder-rock" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#777064" />
          <stop offset=".45" stopColor="#302f31" />
          <stop offset="1" stopColor="#11141b" />
        </linearGradient>
        <radialGradient id="cinder-glow">
          <stop stopColor="#e0a15a" stopOpacity=".32" />
          <stop offset="1" stopColor="#e0a15a" stopOpacity="0" />
        </radialGradient>
        <filter id="cinder-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width="1200" height="360" fill="url(#cinder-space)" />
      <circle cx="940" cy="34" r="170" fill="url(#cinder-glow)" />
      <g fill="#e6e1d6" opacity=".58">
        <circle cx="80" cy="54" r="1.5" /><circle cx="180" cy="120" r="1" />
        <circle cx="290" cy="32" r="1.3" /><circle cx="416" cy="78" r="1" />
        <circle cx="510" cy="27" r="1.5" /><circle cx="681" cy="56" r="1" />
        <circle cx="776" cy="102" r="1.3" /><circle cx="1020" cy="82" r="1" />
        <circle cx="1110" cy="46" r="1.4" /><circle cx="1062" cy="217" r="1" />
        <circle cx="118" cy="244" r="1.2" /><circle cx="310" cy="285" r="1" />
      </g>

      <g fill="none" stroke="#d4d0c7">
        <ellipse cx="604" cy="190" rx="486" ry="139" strokeWidth="2" strokeOpacity=".17" transform="rotate(-9 604 190)" />
        <ellipse cx="604" cy="190" rx="427" ry="111" strokeWidth="12" strokeOpacity=".28" transform="rotate(-9 604 190)" />
        <ellipse cx="604" cy="190" rx="427" ry="111" stroke="#b7bcc3" strokeWidth="2" strokeOpacity=".8" strokeDasharray="86 28 41 24" transform="rotate(-9 604 190)" />
      </g>
      <g fill="#202832" stroke="#8c969e" strokeWidth="2">
        <path d="M192 92 270 71l36 26-13 37-78 10-34-23z" />
        <path d="m896 58 80 12 17 34-25 26-78-10-21-32z" />
        <path d="m1013 226 61-17 35 20-4 33-67 23-34-27z" />
        <path d="m174 239 72 5 21 27-32 26-77-10-14-27z" />
        <path d="m547 59 84-14 23 25-19 32-84 10-18-26z" />
      </g>
      <g fill="#e0a15a" filter="url(#cinder-soft-glow)" opacity=".8">
        <circle cx="266" cy="105" r="7" /><circle cx="935" cy="88" r="7" />
        <circle cx="1046" cy="245" r="7" /><circle cx="209" cy="267" r="6" />
      </g>
      <g fill="#e0a15a">
        <circle cx="266" cy="105" r="3" /><circle cx="935" cy="88" r="3" />
        <circle cx="1046" cy="245" r="3" /><circle cx="209" cy="267" r="2.5" />
      </g>

      <path
        d="m430 100 54-29 86-8 64 22 65-10 83 32 54 49-25 44 13 50-54 37-72 6-43 25-77-14-51 12-60-37-69-7-40-46 18-48-19-36 42-25z"
        fill="url(#cinder-rock)"
        stroke="#a29b8d"
        strokeOpacity=".58"
        strokeWidth="3"
      />
      <g fill="#090c11" stroke="#9b9180" strokeOpacity=".35">
        <ellipse cx="501" cy="137" rx="26" ry="11" transform="rotate(-27 501 137)" />
        <ellipse cx="593" cy="107" rx="17" ry="8" transform="rotate(12 593 107)" />
        <ellipse cx="692" cy="139" rx="31" ry="12" transform="rotate(-18 692 139)" />
        <ellipse cx="467" cy="217" rx="21" ry="9" transform="rotate(21 467 217)" />
        <ellipse cx="573" cy="261" rx="30" ry="11" transform="rotate(-15 573 261)" />
        <ellipse cx="739" cy="225" rx="24" ry="9" transform="rotate(23 739 225)" />
      </g>

      <g stroke="#aab3bc" strokeWidth="4" fill="#252c35">
        <path d="m532 108 26-44 18 4-8 46z" />
        <path d="m713 110 44-34 17 10-30 45z" />
        <path d="m475 228-43 28-10-14 42-41z" />
        <path d="m755 212 48 24-8 17-49-24z" />
      </g>
      <g fill="#e0a15a">
        <rect x="546" y="72" width="10" height="5" /><rect x="755" y="83" width="10" height="5" />
        <rect x="427" y="250" width="9" height="5" /><rect x="789" y="238" width="10" height="5" />
      </g>
      <g fill="#78bfff" opacity=".95">
        <path d="m571 162 20-8 11 8-11 8z" /><path d="m692 191 19-7 10 7-10 7z" />
      </g>

      <g strokeWidth="2">
        <path d="m135 166 35-12 21 8-20 15z" fill="#78bfff" stroke="#bfe4ff" />
        <path d="m158 162-20-9" stroke="#78bfff" strokeOpacity=".75" />
        <path d="m1025 154 34-10 18 8-17 14z" fill="#e0a15a" stroke="#f4c58d" />
        <path d="m1044 152 20-9" stroke="#e0a15a" strokeOpacity=".75" />
      </g>
      <g fontFamily="monospace" fontSize="13" letterSpacing="3">
        <text x="44" y="42" fill="#e0a15a">CINDER RING · ASTEROID OPERATIONS</text>
        <text x="46" y="328" fill="#78bfff">USSF TRANSIT</text>
        <text x="1018" y="328" fill="#e0a15a" textAnchor="end">ACCORD TRANSIT</text>
        <text x="601" y="330" fill="#e6e1d6" fillOpacity=".6" textAnchor="middle">RELAY ARRAY · DOCK 04 · COMBAT OPERATIONS</text>
      </g>
      <g fill="none" stroke="#e0a15a" strokeOpacity=".8">
        <path d="M600 87v-24h50" strokeDasharray="3 5" />
        <path d="M741 197h90v-18" strokeDasharray="3 5" />
      </g>
      <g fontFamily="monospace" fontSize="10" letterSpacing="2" fill="#e6e1d6">
        <text x="656" y="61">RELAY ARRAY</text>
        <text x="838" y="176">ARENA APPROACH</text>
      </g>
    </svg>
  );
}
