// Curated icon set for categories — no extra npm package needed, sirf
// inline SVGs. Admin panel se icon select hota hai (ya "Auto" chhod do,
// khud category ke naam se sahi icon guess ho jayega), yahan render hota hai.

const ICONS = {
  electronics: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  software: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M7 20h10M9 8l-2 2 2 2M15 8l2 2-2 2M13 8l-2 4" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  watches: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 9v3l2 1.5" />
      <path d="M9.5 3h5l-.6 3h-3.8zM9.5 21h5l-.6-3h-3.8z" />
    </>
  ),
  fashion: (
    <>
      <path d="M12 3l2.2 2.2a2 2 0 0 1 0 2.83L12 10" />
      <path d="M12 3L9.8 5.2a2 2 0 0 0 0 2.83L12 10" />
      <path d="M12 10l8 3-1.4 3L17 15v6H7v-6l-1.6 1-1.4-3 8-3z" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  beauty: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3c1.3 2 1.3 3.6 0 5-1.3-1.4-1.3-3 0-5zM12 21c1.3-2 1.3-3.6 0-5-1.3 1.4-1.3 3 0 5zM3 12c2-1.3 3.6-1.3 5 0-1.4 1.3-3 1.3-5 0zM21 12c-2 1.3-3.6 1.3-5 0 1.4-1.3 3-1.3 5 0z" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6c2 2 4 3 6.4 3s4.4-1 6.4-3M5.6 18.4c2-2 4-3 6.4-3s4.4 1 6.4 3" />
    </>
  ),
  toys: (
    <>
      <rect x="2" y="8" width="20" height="10" rx="3" />
      <path d="M7 11v4M5 13h4M16 12h.01M18.5 14h.01" />
    </>
  ),
  books: (
    <>
      <path d="M4 5.5C6 4.5 9 4 12 5v14c-3-1-6-.5-8 .5z" />
      <path d="M20 5.5c-2-1-5-1.5-8-.5v14c3-1 6-.5 8 .5z" />
    </>
  ),
  religion: (
    <>
      <path d="M15 4a8 8 0 1 0 0 16 8 8 0 0 1 0-16z" />
      <path d="M18 5l.8 1.8L20.6 7.6l-1.8.8L18 10.2l-.8-1.8-1.8-.8 1.8-.8z" />
    </>
  ),
  grocery: (
    <>
      <path d="M6 8h12l-1.4 10.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  jewelry: (
    <>
      <path d="M6 3h12l3 5-9 13L3 8z" />
      <path d="M3 8h18M9 3l3 5 3-5M8.5 8L12 21l3.5-13" />
    </>
  ),
  automotive: (
    <>
      <path d="M4 16V11l2.2-5A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.4L20 11v5" />
      <path d="M4 16h16M7 16v2M17 16v2" />
      <circle cx="7.5" cy="14" r="1.4" />
      <circle cx="16.5" cy="14" r="1.4" />
    </>
  ),
  pets: (
    <>
      <circle cx="12" cy="15.5" r="3.2" />
      <circle cx="6" cy="9" r="1.8" />
      <circle cx="18" cy="9" r="1.8" />
      <circle cx="9.5" cy="6" r="1.8" />
      <circle cx="14.5" cy="6" r="1.8" />
    </>
  ),
  furniture: (
    <>
      <path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" />
      <path d="M4 12h16v5H4z" />
      <path d="M5 17v3M19 17v3" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="6" r="1.8" />
      <circle cx="18" cy="6" r="1.8" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="18" cy="18" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12l9-9h6a2 2 0 0 1 2 2v6l-9 9a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8z" />
      <circle cx="15.5" cy="8.5" r="1.4" />
    </>
  ),
};

// Category name me keywords dhoond kar sahi icon khud pick karta hai —
// isse admin ko manually har category ke liye icon select nahi karna
// padta, naya naam type karo, icon khud match ho jata hai.
const KEYWORD_MAP = [
  [["watch"], "watches"],
  [["cloth", "fashion", "dress", "wear", "apparel"], "fashion"],
  [["islam", "quran", "abaya", "hijab", "deen", "prayer"], "religion"],
  [["workout", "gym", "fitness"], "sports"],
  [["sport", "cricket", "football"], "sports"],
  [["software", "app", "program", "code"], "software"],
  [["laptop", "computer", "pc"], "electronics"],
  [["mobile", "phone", "cell"], "mobile"],
  [["beauty", "cosmetic", "makeup", "skin", "health"], "beauty"],
  [["book", "stationery", "stationary"], "books"],
  [["grocery", "food", "kitchen"], "grocery"],
  [["jewel", "ring", "necklace"], "jewelry"],
  [["car", "auto", "bike", "vehicle"], "automotive"],
  [["pet", "dog", "cat"], "pets"],
  [["furniture", "sofa", "chair", "table"], "furniture"],
  [["toy", "game"], "toys"],
  [["home", "living", "decor"], "home"],
  [["electronic", "gadget", "accessor"], "electronics"],
];

export function guessCategoryIcon(name) {
  const n = String(name || "").toLowerCase();
  for (const [keywords, icon] of KEYWORD_MAP) {
    if (keywords.some((k) => n.includes(k))) return icon;
  }
  return "more";
}

// Category document se render karne layak icon nikaalta hai — agar
// koi valid icon already saved hai wahi use hoga, warna naam se guess
// ho jayega (purani categories jinka icon set nahi tha unke liye bhi).
export function resolveCategoryIcon(category) {
  if (category?.icon && ICONS[category.icon]) return category.icon;
  return guessCategoryIcon(category?.name);
}

// Admin ke dropdown me dikhne wali list — label + value.
export const CATEGORY_ICON_OPTIONS = [
  { value: "auto", label: "Auto (recommended)" },
  { value: "electronics", label: "Electronics" },
  { value: "software", label: "Software / Apps" },
  { value: "mobile", label: "Mobiles" },
  { value: "watches", label: "Watches" },
  { value: "fashion", label: "Fashion" },
  { value: "home", label: "Home & Living" },
  { value: "beauty", label: "Beauty & Health" },
  { value: "sports", label: "Sports / Workout" },
  { value: "toys", label: "Toys & Games" },
  { value: "books", label: "Books" },
  { value: "religion", label: "Islamic / Religious" },
  { value: "grocery", label: "Grocery" },
  { value: "jewelry", label: "Jewelry" },
  { value: "automotive", label: "Automotive" },
  { value: "pets", label: "Pets" },
  { value: "furniture", label: "Furniture" },
  { value: "more", label: "More / Other" },
  { value: "tag", label: "Generic tag" },
];

export default function CategoryIcon({ icon, size = 26, color = "currentColor" }) {
  const shape = ICONS[icon] || ICONS.more;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  );
}