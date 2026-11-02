const fs = require("fs");
const file = "src/App.tsx";
let s = fs.readFileSync(file, "utf8");

const replacements = [
  [
    '<span className="cc-primary-icon" aria-hidden="true">SCAN</span>',
    '<span className="cc-primary-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14h2v2h-2zM19 19h2v2h-2z"/></svg></span>'
  ],
  [
    '<span className="cc-quick-icon" aria-hidden="true">AT</span>',
    '<span className="cc-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M16 5.5a3.5 3.5 0 0 1 0 6.8M18 14a5 5 0 0 1 3.5 4.8V20"/></svg></span>'
  ],
  [
    '<span className="cc-quick-icon" aria-hidden="true">BAND</span>',
    '<span className="cc-quick-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16v12H4zM8 6v12M16 6v12"/><path d="M10 10h4M10 14h4"/></svg></span>'
  ],
  [
    '<span className="cc-primary-arrow" aria-hidden="true">-&gt;</span>',
    '<span className="cc-primary-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>'
  ],
  [
    '<span className="cc-quick-arrow" aria-hidden="true">-&gt;</span>',
    '<span className="cc-quick-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span>'
  ]
];

fs.copyFileSync(file, "local-fix-backup/App.tsx.before-svg-icons");

let count = 0;
for (const [oldText, newText] of replacements) {
  const occurrences = s.split(oldText).length - 1;
  if (occurrences > 0) {
    s = s.split(oldText).join(newText);
    count += occurrences;
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("Icon replacements made:", count);
console.log("Backup saved.");
