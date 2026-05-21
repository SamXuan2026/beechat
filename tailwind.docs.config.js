module.exports = {
  content: [
    "./README.html",
    "./docs/**/*.html",
    "./design/**/*.html",
    "./scripts/build-docs.js"
  ],
  theme: {
    extend: {
      colors: {
        bee: {
          ink: "#182033",
          muted: "#657086",
          page: "#f5f7fb",
          panel: "#ffffff",
          line: "#e3e8f0",
          primary: "#4a9fd8",
          primaryDark: "#2f7fba",
          sidebar: "#27184f",
          sidebarSoft: "#3a236b",
          code: "#101828"
        }
      },
      boxShadow: {
        doc: "0 22px 70px rgba(24, 32, 51, 0.10)"
      },
      fontFamily: {
        sans: ["Inter", "PingFang SC", "Microsoft YaHei", "Arial", "sans-serif"],
        mono: ["SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};
