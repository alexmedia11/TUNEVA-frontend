const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduced && matchMedia("(pointer:fine)").matches) {
  for (const card of document.querySelectorAll(".glass-tilt")) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.transform = `perspective(1000px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 5}deg) rotateX(${(0.5 - (e.clientY - r.top) / r.height) * 5}deg)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  }
}
