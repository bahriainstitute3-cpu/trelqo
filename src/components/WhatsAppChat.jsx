import { useEffect, useState } from "react";

export const SHOP_WHATSAPP = "923040024727"; // 03040024727

// Opens WhatsApp with a ready message on the given number.
export function openWhatsApp(message, phone = SHOP_WHATSAPP) {
  const num = String(phone || SHOP_WHATSAPP).replace(/\D/g, "").replace(/^0/, "92");
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message || "")}`, "_blank", "noopener");
}

/**
 * Small message box. Use it two ways:
 *  1) Floating button (default):  <WhatsAppChat />
 *  2) Controlled (product page):  <WhatsAppChat floating={false} open={open} onClose={...} phone={seller} presetText="Hi, I want Patek phillipe" />
 */
export default function WhatsAppChat({
  floating = true,
  open: openProp,
  onClose,
  phone = SHOP_WHATSAPP,
  presetText = "",
  title = "Trelqo Pakistan",
}) {
  const [openState, setOpenState] = useState(false);
  const open = floating ? openState : !!openProp;
  const [text, setText] = useState(presetText);

  useEffect(() => { if (open) setText(presetText); }, [open, presetText]);

  function close() {
    if (floating) setOpenState(false);
    else onClose && onClose();
  }

  function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    openWhatsApp(text.trim(), phone);
    close();
  }

  return (
    <>
      <style>{`
        .shwa-fab{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border-radius:50%;background:#25d366;
          border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9998;
          box-shadow:0 6px 18px rgba(0,0,0,.28)}
        .shwa-box{position:fixed;right:18px;bottom:88px;width:min(340px,calc(100vw - 36px));background:#fff;border-radius:16px;
          box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:9999;overflow:hidden;animation:shwaIn .18s ease-out}
        @keyframes shwaIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .shwa-head{background:#075e54;color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:800}
        .shwa-body{padding:14px;background:#efeae2}
        .shwa-body textarea{width:100%;min-height:96px;border:1px solid #d6d6d6;border-radius:10px;padding:10px;font:inherit;font-size:14px;resize:vertical;box-sizing:border-box}
        .shwa-send{margin-top:10px;width:100%;padding:12px;border:none;border-radius:10px;background:#25d366;color:#fff;font-weight:800;font-size:15px;cursor:pointer}
      `}</style>

      {floating && (
        <button type="button" className="shwa-fab" aria-label="Chat on WhatsApp" onClick={() => setOpenState((v) => !v)}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
            <path d="M16 3C9 3 3.4 8.6 3.4 15.5c0 2.4.7 4.7 1.9 6.6L3 29l7.1-2.2a12.6 12.6 0 0 0 5.9 1.5c7 0 12.6-5.6 12.6-12.6S23 3 16 3zm0 22.9c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.2 1.3 1.4-4.1-.3-.4a10.2 10.2 0 0 1-1.6-5.5C5.6 9.9 10.2 5.3 16 5.3s10.4 4.6 10.4 10.3S21.700 25.900 16 25.900zm5.700-7.700c-.3-.2-1.900-.9-2.200-1s-.5-.2-.7.2-.8 1-1 1.200-.4.2-.7.1a8.400 8.400 0 0 1-2.500-1.500 9.300 9.300 0 0 1-1.700-2.100c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-1-2.300c-.2-.6-.5-.5-.7-.5h-.6a1.200 1.200 0 0 0-.9.400 3.700 3.700 0 0 0-1.100 2.700c0 1.600 1.200 3.200 1.300 3.400s2.300 3.500 5.600 4.900c.8.300 1.400.5 1.900.7.800.2 1.500.2 2.100.1.600-.1 1.900-.8 2.100-1.500s.3-1.400.2-1.500-.3-.2-.6-.4z"/>
          </svg>
        </button>
      )}

      {open && (
        <div className="shwa-box" role="dialog" aria-label="WhatsApp message">
          <div className="shwa-head">
            <span>💬 {title}</span>
            <button type="button" onClick={close} aria-label="Close" style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>
          <form className="shwa-body" onSubmit={send}>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Apna message likhein…" />
            <button type="submit" className="shwa-send">Send on WhatsApp</button>
          </form>
        </div>
      )}
    </>
  );
}