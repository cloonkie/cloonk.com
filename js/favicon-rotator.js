(function () {
  "use strict";

  var frames = [
    { bg: "#FFFFFF", fg: "#000000", face: "ʕっ•ᴥ•ʔっ" },
    { bg: "#E8FF4F", fg: "#000000", face: "ʕ·ᴥ·ʔ⭐" },
    { bg: "#000000", fg: "#E8FF4F", face: "ʕง•ᴥ•ʔง" },
    { bg: "#FF7AD9", fg: "#000000", face: "ʕ༼ƈل͜ƈ༽ʔ" },
    { bg: "#2A2AFF", fg: "#FFFFFF", face: "ʕ⊙ᴥ⊙ʔ" },
    { bg: "#00F5A0", fg: "#000000", face: "ʕ´•㈨•`ʔ" },
    { bg: "#000000", fg: "#FFFFFF", face: "ʕ◉ᴥ◉ʔ" },
    { bg: "#000000", fg: "#E8FF4F", face: "ʕ´•ᴥ•`ʔ" }
  ];

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
      }[char];
    });
  }

  function iconHref(frame) {
    var svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
      '<rect width="64" height="64" rx="14" fill="' + frame.bg + '"/>',
      '<text x="32" y="34" fill="' + frame.fg + '" font-family="Arial, sans-serif" font-size="16" font-weight="900" text-anchor="middle" dominant-baseline="middle" letter-spacing="-1.4">',
      escapeXml(frame.face),
      "</text>",
      "</svg>"
    ].join("");

    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function findIconLink() {
    var link = document.querySelector('link[rel~="icon"]');
    if (link) return link;

    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
    return link;
  }

  function start() {
    var icon = findIconLink();
    var index = 0;

    function showFrame() {
      icon.href = iconHref(frames[index]);
      index = (index + 1) % frames.length;
    }

    showFrame();

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setInterval(showFrame, 2000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
