const CONTACT_PHONE = "03040024727";
const CONTACT_EMAIL = "anusch2026@gmail.com";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/anus_20_26/",
    bg: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
        <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.97.24 2.43.4a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.16.46.35 1.26.4 2.43.07 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.24 1.97-.4 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.16-1.26.35-2.43.4-1.25.07-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.97-.24-2.43-.4a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.16-.46-.35-1.26-.4-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.24-1.97.4-2.43a4.9 4.9 0 0 1 1.15-1.77A4.9 4.9 0 0 1 5.59 1.8c.46-.16 1.26-.35 2.43-.4C9.27 1.33 9.67 1.33 12 1.33m0-1.33C8.74 0 8.33 0 7.05.07c-1.28.06-2.15.26-2.91.56A6.3 6.3 0 0 0 1.85 2.1 6.3 6.3 0 0 0 .49 4.39c-.3.76-.5 1.63-.56 2.91C-.14 8.58-.14 8.99-.14 12.25s0 3.67.07 4.95c.06 1.28.26 2.15.56 2.91a6.3 6.3 0 0 0 1.36 2.29 6.3 6.3 0 0 0 2.29 1.36c.76.3 1.63.5 2.91.56 1.28.07 1.69.07 4.95.07s3.67 0 4.95-.07c1.28-.06 2.15-.26 2.91-.56a6.3 6.3 0 0 0 2.29-1.36 6.3 6.3 0 0 0 1.36-2.29c.3-.76.5-1.63.56-2.91.07-1.28.07-1.69.07-4.95s0-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91A6.3 6.3 0 0 0 22.15 1.85 6.3 6.3 0 0 0 19.86.49c-.76-.3-1.63-.5-2.91-.56C15.67 0 15.26 0 12 0z"/>
        <path d="M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
        <circle cx="18.4" cy="5.6" r="1.44"/>
      </svg>
    ),
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/groups/2174879403074280",
    bg: "#1877F2",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.17 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.77 8.44-4.94 8.44-9.94z"/>
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@shophub.pk",
    bg: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
        <path d="M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.62h-3.06v13.44a2.6 2.6 0 1 1-1.84-2.49v-3.1a5.66 5.66 0 1 0 4.9 5.61V9.73a6.87 6.87 0 0 0 4.02 1.29V7.96c-.94 0-1.85-.3-2.62-.83a4.7 4.7 0 0 1 0-1.31z"/>
      </svg>
    ),
  },
  {
    name: "WhatsApp Channel",
    href: "https://whatsapp.com/channel/0029VbCLNAl9hXFC2Gr26u3a",
    bg: "#25D366",
    icon: (
      <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff" aria-hidden="true">
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.34.687 4.518 1.869 6.35L4 29l7.82-1.828A11.94 11.94 0 0 0 16.001 27C22.628 27 28 21.627 28 15S22.628 3 16.001 3zm0 21.75c-1.94 0-3.75-.55-5.29-1.503l-.38-.226-4.64 1.085 1.108-4.52-.248-.393A9.71 9.71 0 0 1 5.25 15c0-5.93 4.822-10.75 10.751-10.75S26.751 9.07 26.751 15 21.93 24.75 16.001 24.75zm5.888-8.06c-.322-.161-1.905-.94-2.2-1.047-.295-.108-.51-.161-.725.161-.215.322-.833 1.047-1.022 1.262-.188.215-.376.242-.698.081-.322-.161-1.36-.501-2.591-1.598-.958-.854-1.605-1.909-1.793-2.231-.188-.322-.02-.496.141-.657.145-.144.322-.376.483-.564.161-.188.215-.322.322-.537.108-.215.054-.403-.027-.564-.081-.161-.725-1.747-.994-2.393-.262-.63-.528-.545-.725-.555l-.617-.011c-.215 0-.564.081-.859.403-.295.322-1.128 1.102-1.128 2.688 0 1.586 1.155 3.118 1.316 3.333.161.215 2.273 3.47 5.508 4.867.77.332 1.37.531 1.838.68.772.246 1.475.211 2.031.128.62-.092 1.905-.779 2.174-1.531.269-.752.269-1.396.188-1.531-.081-.135-.295-.215-.617-.376z"/>
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer style={{ background: "#1a0f2e", color: "#e8e2f0", padding: "40px 20px 24px" }}>
      <div
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 32,
        }}
      >
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#fff" }}>Contact Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14.5 }}>
            <a href={`tel:${CONTACT_PHONE}`} style={{ color: "#e8e2f0", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true">📞</span> {CONTACT_PHONE}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#e8e2f0", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true">✉️</span> {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#fff" }}>Follow Us</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                title={s.name}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: s.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div
        className="container"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.12)",
          marginTop: 32,
          paddingTop: 20,
          fontSize: 13,
          color: "#b7aecb",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} Trelqo. All rights reserved.
      </div>
    </footer>
  );
}