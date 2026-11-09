// ============================================================================
// BUDDY DRAWINGS (js/buddy-art.js)
// The twelve buddies (js/buddies.js), drawn for harmonee in a soft 3D style
// (agreed 9 Nov, from the dragon): lit from the top left so bodies look
// round, big glossy eyes with two highlights, a soft shadow under the head
// and on the floor, chubby proportions. 200 x 200 each.
//
// Colours avoid "boy" and "girl" coding. Parts that move have bd-* classes
// (css/buddies.css): bd-blink on the eyes, and each buddy's own move.
// Gradient ids are prefixed per buddy so drawings never clash.
// ============================================================================
(function () {
  // ---- Shared pieces ------------------------------------------------------------------
  const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ""}/>`).join("");
  // Lit from the top left
  const lit = (id, light, mid, dark) => `<radialGradient id="${id}" cx="34%" cy="28%" r="80%">${stops([[0, light], [0.5, mid], [1, dark]])}</radialGradient>`;
  const lin = (id, list, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
  const soft = (p, sd = 4) => `<filter id="${p}-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
  const eyeDefs = (p, iris) => `
    <radialGradient id="${p}-sclera" cx="45%" cy="35%" r="70%">${stops([[0, "#ffffff"], [1, "#dfe7ee"]])}</radialGradient>
    <radialGradient id="${p}-iris" cx="45%" cy="40%" r="60%">${stops([[0, iris[0]], [0.55, iris[1]], [1, iris[2]]])}</radialGradient>
    <radialGradient id="${p}-cheek" cx="50%" cy="50%" r="50%">${stops([[0, "#ff9a5c", 0.5], [1, "#ff9a5c", 0]])}</radialGradient>`;
  const floor = (p, rx = 46, y = 188) => `<ellipse cx="100" cy="${y}" rx="${rx}" ry="7" fill="#0f172a" opacity="0.22" filter="url(#${p}-soft)"/>`;
  const underShadow = (p, y, rx = 34, colour = "#0f172a") => `<ellipse cx="100" cy="${y}" rx="${rx}" ry="9" fill="${colour}" opacity="0.3" filter="url(#${p}-soft)"/>`;
  const shine = (d) => `<path d="${d}" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"/>`;
  const cheeks = (p, y = 90, dx = 30) => `<ellipse cx="${100 - dx}" cy="${y}" rx="9" ry="6" fill="url(#${p}-cheek)"/><ellipse cx="${100 + dx}" cy="${y}" rx="9" ry="6" fill="url(#${p}-cheek)"/>`;
  // One glossy eye: white, iris, pupil, two highlights (looks slightly inwards)
  const eye = (p, x, y, r = 13, look = 0) => `
    <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.15}" fill="url(#${p}-sclera)"/>
    <circle cx="${x + look}" cy="${y + 1}" r="${r * 0.74}" fill="url(#${p}-iris)"/>
    <circle cx="${x + look}" cy="${y + 2}" r="${r * 0.42}" fill="#120b03"/>
    <circle cx="${x + look - r * 0.3}" cy="${y - r * 0.32}" r="${r * 0.28}" fill="#fff"/>
    <circle cx="${x + look + r * 0.3}" cy="${y + r * 0.4}" r="${r * 0.12}" fill="#fff" opacity="0.9"/>`;
  const eyes = (p, lx, rx, y, r = 13, cls = "bd-blink") => `<g class="${cls}">${eye(p, lx, y, r, 2)}${eye(p, rx, y, r, -2)}</g>`;
  const smile = (x1, x2, y, depth = 8, colour = "#3b1d0e") => `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + depth} ${x2} ${y}" stroke="${colour}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const openSmile = (x1, x2, y, depth = 10) => `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + depth * 1.4} ${x2} ${y} Q${(x1 + x2) / 2} ${y + depth * 0.5} ${x1} ${y} Z" fill="#3a1a14"/><path d="M${(x1 + x2) / 2 - 5} ${y + depth * 0.75} Q${(x1 + x2) / 2} ${y + depth * 1.15} ${(x1 + x2) / 2 + 5} ${y + depth * 0.75} Q${(x1 + x2) / 2} ${y + depth * 0.85} ${(x1 + x2) / 2 - 5} ${y + depth * 0.75} Z" fill="#ff8a6c"/>`;
  const brows = (y, colour, lx = 80, rx = 120) => `<path d="M${lx - 10} ${y} q10 -6 20 -2" stroke="${colour}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M${rx - 10} ${y - 2} q10 -4 20 2" stroke="${colour}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;

  const ART = {};

  // ---- Dragon (approved 9 Nov) ---------------------------------------------------------
  ART.dragon = () => `
      <defs>
        <radialGradient id="dg-body" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#7cf3e0"/><stop offset="0.45" stop-color="#22c3ad"/><stop offset="1" stop-color="#0b6f63"/></radialGradient>
        <radialGradient id="dg-head" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#8af6e6"/><stop offset="0.5" stop-color="#25c7b1"/><stop offset="1" stop-color="#0c7a6c"/></radialGradient>
        <radialGradient id="dg-belly" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6d5"/><stop offset="0.55" stop-color="#fcd770"/><stop offset="1" stop-color="#e9a51c"/></radialGradient>
        <radialGradient id="dg-snout" cx="40%" cy="25%" r="80%"><stop offset="0" stop-color="#c7fbf2"/><stop offset="1" stop-color="#3fd4bf"/></radialGradient>
        <linearGradient id="dg-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8fbef"/><stop offset="0.5" stop-color="#3cd3be"/><stop offset="1" stop-color="#0e8073"/></linearGradient>
        <linearGradient id="dg-horn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset="0.5" stop-color="#f6b93b"/><stop offset="1" stop-color="#c27a0e"/></linearGradient>
        <radialGradient id="dg-iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#f4b860"/><stop offset="0.55" stop-color="#9a5a12"/><stop offset="1" stop-color="#3b2106"/></radialGradient>
        <radialGradient id="dg-sclera" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe7ee"/></radialGradient>
        <radialGradient id="dg-cheek" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a5c" stop-opacity="0.55"/><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"/></radialGradient>
        <filter id="dg-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="#0f172a" opacity="0.22" filter="url(#dg-soft)"/>
      <g class="bd-tail"><path d="M66 158 C36 162 20 140 30 120 C38 136 52 142 70 140 Z" fill="url(#dg-body)"/><path d="M30 120 l-12 -2 l8 -10 l4 12z" fill="url(#dg-horn)"/></g>
      <g class="bd-wing bd-wing-l"><path d="M72 112 C46 82 22 86 16 108 C30 100 42 108 46 122 C52 110 60 108 70 120 Z" fill="url(#dg-wing)"/><path d="M68 112 C50 94 34 92 22 102" stroke="#0e8073" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/></g>
      <g class="bd-wing bd-wing-r"><path d="M128 112 C154 82 178 86 184 108 C170 100 158 108 154 122 C148 110 140 108 130 120 Z" fill="url(#dg-wing)"/><path d="M132 112 C150 94 166 92 178 102" stroke="#0e8073" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/></g>
      <path d="M100 104 C132 104 142 128 142 150 C142 172 124 182 100 182 C76 182 58 172 58 150 C58 128 68 104 100 104 Z" fill="url(#dg-body)"/>
      <path d="M100 118 C118 118 126 134 126 152 C126 168 114 176 100 176 C86 176 74 168 74 152 C74 134 82 118 100 118 Z" fill="url(#dg-belly)"/>
      <path d="M84 140 q16 6 32 0 M82 152 q18 6 36 0 M86 164 q14 5 28 0" stroke="#d58a0c" stroke-width="2.2" fill="none" opacity="0.45" stroke-linecap="round"/>
      <ellipse cx="62" cy="142" rx="9" ry="12" fill="url(#dg-body)" transform="rotate(25 62 142)"/>
      <ellipse cx="138" cy="142" rx="9" ry="12" fill="url(#dg-body)" transform="rotate(-25 138 142)"/>
      <ellipse cx="80" cy="182" rx="15" ry="9" fill="#0c7a6c"/><ellipse cx="120" cy="182" rx="15" ry="9" fill="#0c7a6c"/>
      <circle cx="72" cy="185" r="3.2" fill="#3fd4bf"/><circle cx="80" cy="187" r="3.2" fill="#3fd4bf"/><circle cx="88" cy="185" r="3.2" fill="#3fd4bf"/>
      <circle cx="112" cy="185" r="3.2" fill="#3fd4bf"/><circle cx="120" cy="187" r="3.2" fill="#3fd4bf"/><circle cx="128" cy="185" r="3.2" fill="#3fd4bf"/>
      <ellipse cx="100" cy="112" rx="34" ry="9" fill="#06463e" opacity="0.35" filter="url(#dg-soft)"/>
      <path d="M70 46 C64 30 66 18 74 12 C76 24 82 34 88 40 Z" fill="url(#dg-horn)"/>
      <path d="M130 46 C136 30 134 18 126 12 C124 24 118 34 112 40 Z" fill="url(#dg-horn)"/>
      <path d="M96 34 l4 -10 l4 10 z M88 36 l3 -7 l4 8 z M108 37 l4 -8 l3 7 z" fill="url(#dg-horn)"/>
      <path d="M100 32 C138 32 148 58 148 78 C148 102 128 116 100 116 C72 116 52 102 52 78 C52 58 62 32 100 32 Z" fill="url(#dg-head)"/>
      <path d="M66 50 C74 40 88 36 100 36" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.45" stroke-linecap="round"/>
      <ellipse cx="100" cy="98" rx="27" ry="15" fill="url(#dg-snout)"/>
      <ellipse cx="91" cy="94" rx="2.4" ry="1.8" fill="#0c5f55"/><ellipse cx="109" cy="94" rx="2.4" ry="1.8" fill="#0c5f55"/>
      <path d="M86 102 Q100 114 114 102 Q100 108 86 102 Z" fill="#1d3b37"/>
      <path d="M95 106 Q100 111 105 106 Q100 108 95 106 Z" fill="#ff8a4c"/>
      <ellipse cx="70" cy="90" rx="9" ry="6" fill="url(#dg-cheek)"/><ellipse cx="130" cy="90" rx="9" ry="6" fill="url(#dg-cheek)"/>
      <g class="bd-blink">
        <ellipse cx="81" cy="72" rx="14" ry="16" fill="url(#dg-sclera)"/><ellipse cx="119" cy="72" rx="14" ry="16" fill="url(#dg-sclera)"/>
        <circle cx="83" cy="73" r="10" fill="url(#dg-iris)"/><circle cx="117" cy="73" r="10" fill="url(#dg-iris)"/>
        <circle cx="83" cy="74" r="5.5" fill="#120b03"/><circle cx="117" cy="74" r="5.5" fill="#120b03"/>
        <circle cx="79" cy="68" r="3.8" fill="#fff"/><circle cx="113" cy="68" r="3.8" fill="#fff"/>
        <circle cx="87" cy="78" r="1.6" fill="#fff" opacity="0.9"/><circle cx="121" cy="78" r="1.6" fill="#fff" opacity="0.9"/>
        <path d="M67 64 Q81 52 95 64" stroke="#0c6e61" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>
        <path d="M105 64 Q119 52 133 64" stroke="#0c6e61" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>
      </g>
      <path d="M70 52 q10 -6 20 -2" stroke="#0a5a50" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path d="M110 50 q10 -4 20 2" stroke="#0a5a50" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <g class="bd-puff"><circle cx="150" cy="70" r="9" fill="none" stroke="#e2e8f0" stroke-width="4" opacity="0.9"/><circle cx="166" cy="56" r="6" fill="none" stroke="#f1f5f9" stroke-width="3" opacity="0.8"/></g>`;

  // ---- Fox: burnt orange and cream; flicks its tail, winks ------------------------------
  ART.fox = () => { const p = "fx"; return `
    <defs>${lit(`${p}-fur`, "#ffb27a", "#ee6a1f", "#9a3412")}${lit(`${p}-cream`, "#ffffff", "#fff3dc", "#f1cf9c")}
      ${lin(`${p}-ear`, [[0, "#7c2d12"], [1, "#3f1708"]])}${eyeDefs(p, ["#9be17e", "#3f8f2a", "#173b0e"])}${soft(p)}</defs>
    ${floor(p, 44)}
    <g class="bd-tail"><path d="M128 156 C168 158 184 120 172 92 C166 116 150 128 130 132 Z" fill="url(#${p}-fur)"/>
      <path d="M172 92 C180 108 174 124 162 130 C170 116 170 104 172 92 Z" fill="url(#${p}-cream)"/></g>
    <path d="M100 112 C130 112 138 134 138 152 C138 172 122 182 100 182 C78 182 62 172 62 152 C62 134 70 112 100 112 Z" fill="url(#${p}-fur)"/>
    <path d="M100 124 C116 124 122 140 122 154 C122 170 112 178 100 178 C88 178 78 170 78 154 C78 140 84 124 100 124 Z" fill="url(#${p}-cream)"/>
    <ellipse cx="82" cy="182" rx="13" ry="8" fill="#5a1e0a"/><ellipse cx="118" cy="182" rx="13" ry="8" fill="#5a1e0a"/>
    ${underShadow(p, 118, 30, "#5a1e0a")}
    <path d="M58 66 L64 22 L94 50 Z" fill="url(#${p}-fur)"/><path d="M66 56 L69 34 L86 50 Z" fill="url(#${p}-ear)"/>
    <path d="M142 66 L136 22 L106 50 Z" fill="url(#${p}-fur)"/><path d="M134 56 L131 34 L114 50 Z" fill="url(#${p}-ear)"/>
    <path d="M100 38 C138 38 150 62 150 80 C150 104 124 120 100 122 C76 120 50 104 50 80 C50 62 62 38 100 38 Z" fill="url(#${p}-fur)"/>
    ${shine("M64 58 C72 48 86 42 100 42")}
    <path d="M52 86 C64 106 84 118 100 122 C116 118 136 106 148 86 C138 98 122 104 100 104 C78 104 62 98 52 86 Z" fill="url(#${p}-cream)"/>
    <ellipse cx="100" cy="102" rx="20" ry="13" fill="url(#${p}-cream)"/>
    <ellipse cx="100" cy="96" rx="6.5" ry="5" fill="#1c1917"/><ellipse cx="98" cy="94" rx="2" ry="1.4" fill="#fff" opacity="0.7"/>
    ${smile(92, 108, 104, 6, "#5a1e0a")}
    ${cheeks(p, 92, 32)}
    <g class="bd-blink">${eye(p, 80, 76, 12, 2)}</g>
    <g class="bd-wink-eye"><g class="bd-eye-open">${eye(p, 120, 76, 12, -2)}</g>
      <path class="bd-eye-shut" d="M110 78 q10 8 20 0" stroke="#3f1708" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>
    ${brows(60, "#7c2d12")}`; };

  // ---- Robot: graphite and lime; antenna lights up, thumbs up ---------------------------
  ART.robot = () => { const p = "rb"; return `
    <defs>${lit(`${p}-metal`, "#9ca3af", "#4b5563", "#1f2937")}${lit(`${p}-light`, "#f3f4f6", "#9ca3af", "#4b5563")}
      <radialGradient id="${p}-screen" cx="40%" cy="30%" r="80%">${stops([[0, "#334155"], [1, "#030712"]])}</radialGradient>
      <radialGradient id="${p}-glow" cx="50%" cy="50%" r="50%">${stops([[0, "#ecfccb"], [0.5, "#a3e635"], [1, "#4d7c0f"]])}</radialGradient>${soft(p)}</defs>
    ${floor(p, 44)}
    <g class="bd-antenna"><path d="M100 46 L100 22" stroke="url(#${p}-light)" stroke-width="5" stroke-linecap="round"/>
      <circle class="bd-antenna-light" cx="100" cy="18" r="9" fill="url(#${p}-glow)"/></g>
    <rect x="70" y="164" width="22" height="20" rx="7" fill="url(#${p}-metal)"/><rect x="108" y="164" width="22" height="20" rx="7" fill="url(#${p}-metal)"/>
    <rect x="62" y="112" width="76" height="60" rx="22" fill="url(#${p}-metal)"/>
    <rect x="78" y="126" width="44" height="22" rx="8" fill="url(#${p}-screen)"/>
    <circle cx="89" cy="137" r="4.5" fill="#a3e635"/><circle cx="100" cy="137" r="4.5" fill="#facc15"/><circle cx="111" cy="137" r="4.5" fill="#fb923c"/>
    <g class="bd-arm-l"><rect x="38" y="120" width="28" height="13" rx="6.5" fill="url(#${p}-light)"/><circle cx="38" cy="126" r="10" fill="url(#${p}-metal)"/></g>
    <g class="bd-arm-r"><rect x="134" y="120" width="28" height="13" rx="6.5" fill="url(#${p}-light)"/>
      <g class="bd-thumb"><rect x="152" y="112" width="20" height="20" rx="8" fill="url(#${p}-light)"/><rect x="158" y="96" width="9" height="20" rx="4.5" fill="url(#${p}-light)"/></g></g>
    ${underShadow(p, 112, 30)}
    <rect x="52" y="64" width="10" height="22" rx="5" fill="url(#${p}-light)"/><rect x="138" y="64" width="10" height="22" rx="5" fill="url(#${p}-light)"/>
    <rect x="58" y="42" width="84" height="68" rx="24" fill="url(#${p}-metal)"/>
    ${shine("M70 52 C80 46 92 45 104 45")}
    <rect x="68" y="54" width="64" height="46" rx="16" fill="url(#${p}-screen)"/>
    <g class="bd-blink"><rect x="80" y="64" width="14" height="18" rx="7" fill="url(#${p}-glow)"/><rect x="106" y="64" width="14" height="18" rx="7" fill="url(#${p}-glow)"/>
      <circle cx="84" cy="68" r="2.4" fill="#fff" opacity="0.85"/><circle cx="110" cy="68" r="2.4" fill="#fff" opacity="0.85"/></g>
    <path d="M88 89 Q100 98 112 89" stroke="#a3e635" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="88" rx="5" ry="3" fill="#a3e635" opacity="0.35"/><ellipse cx="128" cy="88" rx="5" ry="3" fill="#a3e635" opacity="0.35"/>`; };

  // ---- Kitten: charcoal and amber; stretches, slow blink --------------------------------
  ART.kitten = () => { const p = "kt"; return `
    <defs>${lit(`${p}-fur`, "#9aa1ab", "#4b5059", "#1d2026")}${lit(`${p}-muzzle`, "#f8fafc", "#d4d7dc", "#9aa1ab")}
      ${lin(`${p}-ear`, [[0, "#fcd34d"], [1, "#d97706"]])}${eyeDefs(p, ["#ffe08a", "#f0a20c", "#7a4a03"])}${soft(p)}</defs>
    ${floor(p, 42)}
    <g class="bd-tail"><path d="M128 168 C160 170 170 148 160 128 C156 120 150 120 150 128 C156 142 150 156 130 156 Z" fill="url(#${p}-fur)"/>
      <path d="M158 132 c3 4 3 8 1 11 M154 146 c4 2 6 5 6 8" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <g class="bd-body"><path d="M100 114 C128 114 136 136 136 154 C136 174 120 184 100 184 C80 184 64 174 64 154 C64 136 72 114 100 114 Z" fill="url(#${p}-fur)"/>
      <ellipse cx="100" cy="158" rx="18" ry="20" fill="url(#${p}-muzzle)" opacity="0.9"/>
      <ellipse cx="84" cy="182" rx="12" ry="8" fill="url(#${p}-muzzle)"/><ellipse cx="116" cy="182" rx="12" ry="8" fill="url(#${p}-muzzle)"/></g>
    ${underShadow(p, 116, 30)}
    <path d="M58 62 L62 22 L92 46 Z" fill="url(#${p}-fur)"/><path d="M65 54 L67 33 L84 47 Z" fill="url(#${p}-ear)"/>
    <path d="M142 62 L138 22 L108 46 Z" fill="url(#${p}-fur)"/><path d="M135 54 L133 33 L116 47 Z" fill="url(#${p}-ear)"/>
    <path d="M100 36 C140 36 150 60 150 80 C150 104 128 118 100 118 C72 118 50 104 50 80 C50 60 60 36 100 36 Z" fill="url(#${p}-fur)"/>
    ${shine("M64 56 C72 46 86 40 100 40")}
    <path d="M94 40 q6 10 0 18 M106 40 q-6 10 0 18" stroke="#f59e0b" stroke-width="3" fill="none" opacity="0.7" stroke-linecap="round"/>
    <ellipse cx="100" cy="100" rx="22" ry="14" fill="url(#${p}-muzzle)"/>
    <path d="M96 94 L104 94 L100 99 Z" fill="#e8834f"/>
    ${smile(92, 100, 102, 5, "#2d2f35")}${smile(100, 108, 102, 5, "#2d2f35")}
    <path d="M78 100 l-22 -3 M78 104 l-22 3 M122 100 l22 -3 M122 104 l22 3" stroke="#e5e7eb" stroke-width="1.8" opacity="0.8" stroke-linecap="round"/>
    ${cheeks(p, 92, 34)}
    ${eyes(p, 80, 120, 76, 12.5, "bd-blink bd-slowblink")}`; };

  // ---- Puppy: caramel and a red collar; bounces, tail wagging ---------------------------
  ART.puppy = () => { const p = "pp"; return `
    <defs>${lit(`${p}-fur`, "#ffd9a0", "#d9913f", "#8a5220")}${lit(`${p}-ear`, "#b8763a", "#8a5220", "#4f2c0e")}${lit(`${p}-white`, "#ffffff", "#f6eee2", "#d9c9b2")}
      ${lin(`${p}-collar`, [[0, "#f87171"], [1, "#b91c1c"]])}${lin(`${p}-tag`, [[0, "#fff1c2"], [1, "#d4a017"]])}${eyeDefs(p, ["#c98a4b", "#6b3d12", "#2a1404"])}${soft(p)}</defs>
    ${floor(p, 44)}
    <g class="bd-tail bd-wag-fast"><path d="M130 150 C150 148 160 132 156 118 C152 112 146 114 146 122 C146 132 140 138 128 140 Z" fill="url(#${p}-fur)"/></g>
    <path d="M100 116 C130 116 138 138 138 156 C138 174 122 184 100 184 C78 184 62 174 62 156 C62 138 70 116 100 116 Z" fill="url(#${p}-fur)"/>
    <ellipse cx="100" cy="160" rx="20" ry="20" fill="url(#${p}-white)"/>
    <ellipse cx="82" cy="182" rx="13" ry="8" fill="url(#${p}-white)"/><ellipse cx="118" cy="182" rx="13" ry="8" fill="url(#${p}-white)"/>
    <path d="M72 120 Q100 132 128 120 L126 128 Q100 140 74 128 Z" fill="url(#${p}-collar)"/>
    <circle cx="100" cy="137" r="7" fill="url(#${p}-tag)"/>
    ${underShadow(p, 116, 30, "#4f2c0e")}
    <path d="M100 36 C140 36 150 60 150 80 C150 104 128 118 100 118 C72 118 50 104 50 80 C50 60 60 36 100 36 Z" fill="url(#${p}-fur)"/>
    ${shine("M66 54 C74 44 88 40 100 40")}
    <path d="M56 50 C38 52 32 80 40 104 C46 112 56 108 58 98 C60 84 62 66 68 56 Z" fill="url(#${p}-ear)"/>
    <path d="M144 50 C162 52 168 80 160 104 C154 112 144 108 142 98 C140 84 138 66 132 56 Z" fill="url(#${p}-ear)"/>
    <ellipse cx="100" cy="100" rx="24" ry="16" fill="url(#${p}-white)"/>
    <ellipse cx="100" cy="92" rx="8" ry="6" fill="#1c1410"/><ellipse cx="97" cy="90" rx="2.6" ry="1.6" fill="#fff" opacity="0.7"/>
    <path d="M90 102 Q100 112 110 102" stroke="#2a1404" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M100 104 C100 118 110 120 110 110 Q106 106 100 104 Z" fill="#f87171"/>
    ${cheeks(p, 94, 34)}
    ${eyes(p, 80, 120, 72, 12.5)}
    ${brows(56, "#6b3d12")}`; };

  // ---- Unicorn: white and gold, rainbow mane; spins in stars ----------------------------
  ART.unicorn = () => { const p = "un"; return `
    <defs>${lit(`${p}-coat`, "#ffffff", "#eef1f6", "#b9c2d0")}${lin(`${p}-horn`, [[0, "#fff4c4"], [0.5, "#f5c542"], [1, "#b8860b"]])}
      ${lin(`${p}-hoof`, [[0, "#fde68a"], [1, "#b8860b"]])}${eyeDefs(p, ["#b49cf0", "#5b3fb4", "#24124f"])}${soft(p)}</defs>
    ${floor(p, 44)}
    <g class="bd-tail"><path d="M64 156 C40 156 30 136 38 116" stroke="#ef4444" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M64 162 C38 164 24 142 32 120" stroke="#f59e0b" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M66 168 C36 172 18 150 26 126" stroke="#22c55e" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M68 174 C34 180 12 158 20 132" stroke="#8b5cf6" stroke-width="7" fill="none" stroke-linecap="round"/></g>
    <path d="M100 116 C130 116 138 138 138 156 C138 174 122 184 100 184 C78 184 62 174 62 156 C62 138 70 116 100 116 Z" fill="url(#${p}-coat)"/>
    <ellipse cx="82" cy="182" rx="12" ry="8" fill="url(#${p}-hoof)"/><ellipse cx="118" cy="182" rx="12" ry="8" fill="url(#${p}-hoof)"/>
    ${underShadow(p, 116, 30, "#64748b")}
    <path d="M70 52 L62 30 L84 44 Z" fill="url(#${p}-coat)"/><path d="M130 52 L138 30 L116 44 Z" fill="url(#${p}-coat)"/>
    <path d="M100 38 C140 38 150 62 150 82 C150 106 128 120 100 120 C72 120 50 106 50 82 C50 62 60 38 100 38 Z" fill="url(#${p}-coat)"/>
    <path d="M100 6 L110 46 L90 46 Z" fill="url(#${p}-horn)"/>
    <path d="M92 38 l15 -5 M94 28 l11 -4 M96 18 l7 -3" stroke="#b8860b" stroke-width="2" opacity="0.6" stroke-linecap="round"/>
    <path d="M118 42 C140 40 152 54 150 70 C146 60 136 56 128 58 Z" fill="#ef4444"/>
    <path d="M124 48 C146 50 156 66 152 84 C148 72 140 66 132 66 Z" fill="#f59e0b"/>
    <path d="M128 56 C148 62 156 80 150 98 C146 86 140 78 132 76 Z" fill="#22c55e"/>
    <path d="M82 42 C70 38 62 44 60 52 C68 48 76 48 84 50 Z" fill="#8b5cf6"/>
    ${shine("M64 60 C70 50 82 44 92 42")}
    <ellipse cx="100" cy="102" rx="22" ry="14" fill="#f3f0fa"/>
    <ellipse cx="93" cy="100" rx="2.4" ry="1.8" fill="#94a3b8"/><ellipse cx="107" cy="100" rx="2.4" ry="1.8" fill="#94a3b8"/>
    ${smile(92, 108, 106, 6, "#475569")}
    ${cheeks(p, 92, 32)}
    ${eyes(p, 80, 120, 78, 12.5)}
    <path d="M68 66 l-4 -3 M72 63 l-2 -4 M132 66 l4 -3 M128 63 l2 -4" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>`; };

  // ---- Knight: silver armour, green plume; raises a sword, bows --------------------------
  ART.knight = () => { const p = "kn"; return `
    <defs>${lit(`${p}-steel`, "#ffffff", "#c9d2dc", "#5d6b7a")}${lit(`${p}-dark`, "#3b4250", "#1c2129", "#0b0d11")}
      ${lin(`${p}-plume`, [[0, "#86efac"], [0.5, "#16a34a"], [1, "#14532d"]])}${lin(`${p}-gold`, [[0, "#fff1c2"], [1, "#c58b0c"]])}
      ${lin(`${p}-blade`, [[0, "#ffffff"], [1, "#94a3b8"]], 1, 0)}${eyeDefs(p, ["#9fd3ff", "#2f6db5", "#0e2a4d"])}${soft(p)}</defs>
    ${floor(p, 46)}
    <g class="bd-bow">
    <rect x="72" y="166" width="22" height="18" rx="7" fill="url(#${p}-steel)"/><rect x="106" y="166" width="22" height="18" rx="7" fill="url(#${p}-steel)"/>
    <path d="M100 112 C130 112 138 134 138 152 C138 170 122 178 100 178 C78 178 62 170 62 152 C62 134 70 112 100 112 Z" fill="url(#${p}-steel)"/>
    <path d="M70 124 Q100 132 130 124" stroke="#5d6b7a" stroke-width="2" fill="none" opacity="0.5"/>
    <g class="bd-shield"><path d="M48 128 L78 124 L78 150 C78 164 66 172 62 174 C58 172 46 164 46 150 Z" fill="url(#${p}-steel)" stroke="#5d6b7a" stroke-width="2"/>
      <path d="M62 130 L62 168 M50 146 L74 146" stroke="#16a34a" stroke-width="6" stroke-linecap="round"/></g>
    <g class="bd-sword"><rect x="136" y="134" width="20" height="8" rx="4" fill="url(#${p}-gold)"/>
      <rect x="143" y="142" width="6" height="14" rx="3" fill="#7c4a12"/>
      <path d="M142 134 L146 82 L150 134 Z" fill="url(#${p}-blade)"/></g>
    ${underShadow(p, 114, 32)}
    <g class="bd-plume"><path d="M100 30 C96 10 112 2 126 6 C116 12 112 22 114 34 Z" fill="url(#${p}-plume)"/></g>
    <path d="M100 30 C140 30 150 56 150 78 C150 104 128 118 100 118 C72 118 50 104 50 78 C50 56 60 30 100 30 Z" fill="url(#${p}-steel)"/>
    ${shine("M64 52 C72 40 86 34 100 34")}
    <rect x="62" y="58" width="76" height="40" rx="18" fill="url(#${p}-dark)"/>
    ${eyes(p, 82, 118, 77, 11)}
    <path d="M100 30 L100 58" stroke="#5d6b7a" stroke-width="3" opacity="0.6"/>
    <path d="M70 106 Q100 114 130 106" stroke="#5d6b7a" stroke-width="2.5" fill="none" opacity="0.6"/>
    ${smile(92, 108, 102, 6, "#334155")}
    <circle cx="58" cy="78" r="5" fill="url(#${p}-gold)"/><circle cx="142" cy="78" r="5" fill="url(#${p}-gold)"/>
    </g>`; };

  // ---- Owl: olive and mustard; turns its head, nods ---------------------------------------
  ART.owl = () => { const p = "ow"; return `
    <defs>${lit(`${p}-feather`, "#cdd68a", "#7d8a32", "#3f4714")}${lit(`${p}-face`, "#fff7d6", "#f6cf55", "#c9930f")}
      ${lit(`${p}-chest`, "#fffbea", "#f3e3b0", "#c9b277")}${lin(`${p}-beak`, [[0, "#ffd08a"], [1, "#d97706"]])}${eyeDefs(p, ["#ffe27a", "#e08a0b", "#6b3903"])}${soft(p)}</defs>
    ${floor(p, 42)}
    <path d="M100 96 C138 96 146 128 146 150 C146 172 128 184 100 184 C72 184 54 172 54 150 C54 128 62 96 100 96 Z" fill="url(#${p}-feather)"/>
    <path d="M100 116 C120 116 128 136 128 152 C128 170 116 178 100 178 C84 178 72 170 72 152 C72 136 80 116 100 116 Z" fill="url(#${p}-chest)"/>
    <path d="M82 134 l4 4 l4 -4 M96 134 l4 4 l4 -4 M110 134 l4 4 l4 -4 M88 146 l4 4 l4 -4 M104 146 l4 4 l4 -4 M80 158 l4 4 l4 -4 M96 158 l4 4 l4 -4 M112 158 l4 4 l4 -4 M88 170 l4 4 l4 -4 M104 170 l4 4 l4 -4" stroke="#b39a58" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <g class="bd-wing bd-wing-l"><path d="M56 120 C40 130 38 156 50 170 C58 160 62 140 62 124 Z" fill="url(#${p}-feather)"/></g>
    <g class="bd-wing bd-wing-r"><path d="M144 120 C160 130 162 156 150 170 C142 160 138 140 138 124 Z" fill="url(#${p}-feather)"/></g>
    <path d="M84 182 l-4 6 M90 183 v6 M116 182 l4 6 M110 183 v6" stroke="#d97706" stroke-width="3.5" stroke-linecap="round"/>
    ${underShadow(p, 110, 34, "#3f4714")}
    <g class="bd-head">
    <path d="M60 46 L56 20 L80 38 Z" fill="url(#${p}-feather)"/><path d="M140 46 L144 20 L120 38 Z" fill="url(#${p}-feather)"/>
    <path d="M100 30 C142 30 152 56 152 76 C152 100 128 112 100 112 C72 112 48 100 48 76 C48 56 58 30 100 30 Z" fill="url(#${p}-feather)"/>
    ${shine("M62 50 C70 40 84 34 100 34")}
    <circle cx="80" cy="74" r="22" fill="url(#${p}-face)"/><circle cx="120" cy="74" r="22" fill="url(#${p}-face)"/>
    ${eyes(p, 80, 120, 74, 14)}
    <path d="M100 84 L92 92 L100 104 L108 92 Z" fill="url(#${p}-beak)"/>
    <path d="M62 56 q18 -10 34 2 M104 58 q16 -12 34 -2" stroke="#3f4714" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    </g>`; };

  // ---- Astronaut: white suit, orange visor; floats up, salutes ----------------------------
  ART.astronaut = () => { const p = "as"; return `
    <defs>${lit(`${p}-suit`, "#ffffff", "#e7ebf0", "#a5afbd")}
      <radialGradient id="${p}-visor" cx="35%" cy="30%" r="80%">${stops([[0, "#ffd8a8"], [0.35, "#fb923c"], [0.8, "#9a3412"], [1, "#431407"]])}</radialGradient>
      ${lin(`${p}-pack`, [[0, "#cbd5e1"], [1, "#64748b"]])}${eyeDefs(p, ["#ffffff", "#e2e8f0", "#94a3b8"])}${soft(p)}</defs>
    ${floor(p, 40)}
    <g class="bd-float">
    <rect x="64" y="108" width="72" height="50" rx="14" fill="url(#${p}-pack)"/>
    <rect x="72" y="160" width="22" height="22" rx="8" fill="url(#${p}-suit)"/><rect x="106" y="160" width="22" height="22" rx="8" fill="url(#${p}-suit)"/>
    <rect x="72" y="176" width="22" height="8" rx="4" fill="#fb923c"/><rect x="106" y="176" width="22" height="8" rx="4" fill="#fb923c"/>
    <path d="M100 112 C130 112 138 132 138 148 C138 166 122 172 100 172 C78 172 62 166 62 148 C62 132 70 112 100 112 Z" fill="url(#${p}-suit)"/>
    <rect x="84" y="132" width="32" height="20" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
    <circle cx="93" cy="142" r="3.5" fill="#fb923c"/><circle cx="103" cy="142" r="3.5" fill="#22c55e"/><rect x="108" y="139" width="5" height="6" rx="1.5" fill="#64748b"/>
    <g class="bd-arm-l"><path d="M64 126 C50 132 46 148 52 156" stroke="url(#${p}-suit)" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="52" cy="158" r="8" fill="#fb923c"/></g>
    <g class="bd-salute"><path d="M136 126 C150 132 154 148 148 156" stroke="url(#${p}-suit)" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="148" cy="158" r="8" fill="#fb923c"/></g>
    ${underShadow(p, 112, 32)}
    <circle cx="100" cy="72" r="48" fill="url(#${p}-suit)"/>
    ${shine("M62 52 C70 38 84 30 100 28")}
    <rect x="62" y="48" width="76" height="54" rx="27" fill="url(#${p}-visor)"/>
    <path d="M72 58 C80 52 92 50 102 52" stroke="#fff" stroke-width="5" fill="none" opacity="0.55" stroke-linecap="round"/>
    <g class="bd-blink" opacity="0.95"><ellipse cx="86" cy="78" rx="7" ry="9" fill="#fff7ed"/><ellipse cx="114" cy="78" rx="7" ry="9" fill="#fff7ed"/>
      <circle cx="87" cy="80" r="4" fill="#1c0b03"/><circle cx="113" cy="80" r="4" fill="#1c0b03"/><circle cx="85" cy="77" r="1.6" fill="#fff"/><circle cx="111" cy="77" r="1.6" fill="#fff"/></g>
    ${smile(92, 108, 90, 6, "#fff7ed")}
    <rect x="94" y="16" width="12" height="10" rx="3" fill="#94a3b8"/>
    </g>`; };

  // ---- Octopus: deep purple and gold; waves all eight arms --------------------------------
  ART.octopus = () => { const p = "oc"; const arm = (i, d) => `<g class="bd-oct-arm bd-oct-arm-${i}"><path d="${d}" stroke="url(#${p}-skin)" stroke-width="13" fill="none" stroke-linecap="round"/></g>`; return `
    <defs>${lit(`${p}-skin`, "#c4b5fd", "#7c3aed", "#3b0764")}${lit(`${p}-gold`, "#fff3c4", "#f5c542", "#b8860b")}${eyeDefs(p, ["#ffe7a3", "#e0a40b", "#5c3a03"])}${soft(p)}</defs>
    ${floor(p, 54)}
    ${arm(1, "M70 140 C54 150 40 160 34 178")}${arm(2, "M78 148 C70 162 62 174 60 188")}${arm(3, "M90 152 C88 166 86 178 88 190")}${arm(4, "M110 152 C112 166 114 178 112 190")}
    ${arm(5, "M122 148 C130 162 138 174 140 188")}${arm(6, "M130 140 C146 150 160 160 166 178")}${arm(7, "M66 128 C48 126 34 118 26 104")}${arm(8, "M134 128 C152 126 166 118 174 104")}
    <path d="M100 30 C146 30 156 70 156 100 C156 136 132 156 100 156 C68 156 44 136 44 100 C44 70 54 30 100 30 Z" fill="url(#${p}-skin)"/>
    ${shine("M60 70 C64 50 80 38 98 36")}
    <circle cx="74" cy="56" r="6" fill="url(#${p}-gold)" opacity="0.85"/><circle cx="120" cy="46" r="4.5" fill="url(#${p}-gold)" opacity="0.85"/><circle cx="134" cy="66" r="5.5" fill="url(#${p}-gold)" opacity="0.85"/><circle cx="96" cy="42" r="3.5" fill="url(#${p}-gold)" opacity="0.85"/>
    ${eyes(p, 80, 120, 96, 14)}
    ${openSmile(88, 112, 120, 9)}
    ${cheeks(p, 116, 34)}
    ${brows(78, "#3b0764")}`; };

  // ---- Dinosaur: leaf green and yellow; stomps, happy roar --------------------------------
  ART.dinosaur = () => { const p = "dn"; return `
    <defs>${lit(`${p}-skin`, "#a7f3a0", "#3fae54", "#14532d")}${lit(`${p}-belly`, "#fffbd1", "#fde68a", "#e3b324")}${lin(`${p}-spike`, [[0, "#fff1a8"], [1, "#e0a10b"]])}
      ${eyeDefs(p, ["#ffe48a", "#c97e0b", "#4a2a03"])}${soft(p)}</defs>
    ${floor(p, 48)}
    <g class="bd-tail"><path d="M66 158 C34 166 18 150 20 130 C30 144 46 148 68 144 Z" fill="url(#${p}-skin)"/></g>
    <path d="M100 108 C134 108 142 132 142 152 C142 172 124 184 100 184 C76 184 58 172 58 152 C58 132 66 108 100 108 Z" fill="url(#${p}-skin)"/>
    <path d="M100 120 C118 120 126 138 126 154 C126 170 114 178 100 178 C86 178 74 170 74 154 C74 138 82 120 100 120 Z" fill="url(#${p}-belly)"/>
    <path d="M84 142 q16 5 32 0 M82 156 q18 5 36 0" stroke="#d4a017" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round"/>
    <path d="M64 130 c-8 4 -10 12 -6 16 M136 130 c8 4 10 12 6 16" stroke="url(#${p}-skin)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="80" cy="182" rx="15" ry="9" fill="#14532d"/><ellipse cx="120" cy="182" rx="15" ry="9" fill="#14532d"/>
    <circle cx="72" cy="186" r="3" fill="#fde68a"/><circle cx="80" cy="188" r="3" fill="#fde68a"/><circle cx="88" cy="186" r="3" fill="#fde68a"/>
    <circle cx="112" cy="186" r="3" fill="#fde68a"/><circle cx="120" cy="188" r="3" fill="#fde68a"/><circle cx="128" cy="186" r="3" fill="#fde68a"/>
    ${underShadow(p, 112, 34, "#14532d")}
    <path d="M82 30 l6 -14 l6 14 z M98 26 l6 -16 l6 16 z M114 30 l6 -14 l6 14 z M128 40 l8 -10 l2 14 z" fill="url(#${p}-spike)"/>
    <path d="M100 28 C142 28 152 54 152 76 C152 102 130 116 100 116 C70 116 48 102 48 76 C48 54 58 28 100 28 Z" fill="url(#${p}-skin)"/>
    ${shine("M62 50 C70 38 84 32 100 32")}
    <g class="bd-jaw"><path d="M70 96 Q100 122 130 96 Q100 108 70 96 Z" fill="#2a1410"/>
      <path d="M78 98 l4 6 l4 -5 M114 98 l4 5 l4 -6" fill="#fff"/><path d="M92 106 Q100 113 108 106 Q100 108 92 106 Z" fill="#ff8a6c"/></g>
    <ellipse cx="88" cy="88" rx="2.4" ry="1.8" fill="#14532d"/><ellipse cx="112" cy="88" rx="2.4" ry="1.8" fill="#14532d"/>
    ${cheeks(p, 86, 34)}
    ${eyes(p, 78, 122, 66, 13)}
    ${brows(48, "#14532d", 78, 122)}`; };

  // ---- Sloth: mossy brown and sage; slow wave, slow grin ---------------------------------
  ART.sloth = () => { const p = "sl"; return `
    <defs>${lit(`${p}-fur`, "#d2b48c", "#8f6a42", "#4a3420")}${lit(`${p}-face`, "#f4f7ee", "#cfdcbf", "#9fb08a")}${lit(`${p}-patch`, "#7a5a3a", "#4a3420", "#2a1c10")}
      ${eyeDefs(p, ["#a8865e", "#5a3d1e", "#24170a"])}${soft(p)}</defs>
    ${floor(p, 46)}
    <path d="M100 112 C132 112 140 136 140 156 C140 174 124 184 100 184 C76 184 60 174 60 156 C60 136 68 112 100 112 Z" fill="url(#${p}-fur)"/>
    <ellipse cx="100" cy="160" rx="22" ry="20" fill="#a98559" opacity="0.6"/>
    <ellipse cx="80" cy="182" rx="14" ry="8" fill="url(#${p}-patch)"/><ellipse cx="120" cy="182" rx="14" ry="8" fill="url(#${p}-patch)"/>
    <path d="M66 130 C54 140 54 160 64 168" stroke="url(#${p}-fur)" stroke-width="15" fill="none" stroke-linecap="round"/>
    <g class="bd-wave"><path d="M134 128 C150 120 158 104 156 88" stroke="url(#${p}-fur)" stroke-width="15" fill="none" stroke-linecap="round"/>
      <path d="M150 86 l-2 -10 M156 84 l0 -11 M162 86 l3 -10" stroke="#3a2a1a" stroke-width="3.5" stroke-linecap="round"/></g>
    ${underShadow(p, 114, 32, "#2a1c10")}
    <path d="M100 32 C142 32 152 58 152 78 C152 104 128 118 100 118 C72 118 48 104 48 78 C48 58 58 32 100 32 Z" fill="url(#${p}-fur)"/>
    ${shine("M64 52 C72 42 86 36 100 36")}
    <path d="M100 46 C134 46 142 66 142 80 C142 100 122 110 100 110 C78 110 58 100 58 80 C58 66 66 46 100 46 Z" fill="url(#${p}-face)"/>
    <path d="M60 78 C62 64 78 62 92 72 C92 84 80 88 70 88 C64 88 60 84 60 78 Z" fill="url(#${p}-patch)"/>
    <path d="M140 78 C138 64 122 62 108 72 C108 84 120 88 130 88 C136 88 140 84 140 78 Z" fill="url(#${p}-patch)"/>
    <g class="bd-blink">${eye(p, 78, 76, 9, 1)}${eye(p, 122, 76, 9, -1)}
      <path d="M68 72 Q78 66 88 72 L88 70 Q78 62 68 70 Z" fill="#4a3420"/><path d="M112 72 Q122 66 132 72 L132 70 Q122 62 112 70 Z" fill="#4a3420"/></g>
    <ellipse cx="100" cy="90" rx="7" ry="5" fill="#2a1c10"/><ellipse cx="98" cy="88" rx="2.2" ry="1.4" fill="#fff" opacity="0.6"/>
    <g class="bd-grin">${smile(86, 114, 98, 8, "#3a2a1a")}</g>
    ${cheeks(p, 94, 30)}`; };

  window.BUDDY_ART = ART;
})();
