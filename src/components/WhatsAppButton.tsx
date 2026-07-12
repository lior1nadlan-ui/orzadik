export function WhatsAppButton() {
  const phone = "972545818486";
  const text = encodeURIComponent("הגעתי מהאתר");
  const href = `https://wa.me/${phone}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="צור קשר בוואטסאפ"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-white pl-4 pr-3 py-2.5 shadow-lg ring-2 ring-[#D4AF37] hover:scale-105 transition-transform"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wa-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8C76B" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#A8862A" />
          </linearGradient>
        </defs>
        <path
          fill="url(#wa-gold)"
          d="M16 .5C7.44.5.5 7.44.5 16c0 2.82.74 5.58 2.16 8.01L.5 31.5l7.7-2.02A15.46 15.46 0 0 0 16 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5Zm0 28.2c-2.43 0-4.81-.65-6.89-1.88l-.49-.29-4.57 1.2 1.22-4.45-.32-.51A12.66 12.66 0 0 1 3.3 16C3.3 8.98 8.98 3.3 16 3.3S28.7 8.98 28.7 16 23.02 28.7 16 28.7Zm7.27-9.5c-.4-.2-2.36-1.17-2.73-1.3-.37-.13-.63-.2-.9.2-.26.4-1.03 1.3-1.27 1.56-.23.27-.46.3-.86.1-.4-.2-1.69-.62-3.22-1.99-1.19-1.06-2-2.37-2.23-2.77-.23-.4-.02-.62.18-.82.18-.18.4-.46.6-.7.2-.23.27-.4.4-.66.13-.27.07-.5-.03-.7-.1-.2-.9-2.16-1.23-2.96-.32-.78-.65-.67-.9-.69l-.76-.01c-.27 0-.7.1-1.06.5-.37.4-1.4 1.37-1.4 3.33s1.43 3.86 1.63 4.13c.2.27 2.82 4.3 6.83 6.03.96.42 1.7.67 2.28.85.96.31 1.83.27 2.52.16.77-.12 2.36-.97 2.69-1.9.33-.94.33-1.74.23-1.9-.1-.17-.37-.27-.77-.47Z"
        />
      </svg>
      <span className="text-sm font-semibold text-[#D4AF37]">וואטסאפ</span>
    </a>
  );
}
