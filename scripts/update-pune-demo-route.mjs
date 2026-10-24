import { readFile, writeFile } from "node:fs/promises";

const origin = { id: "deccan-gymkhana", label: "Deccan Gymkhana, Pune", lat: 18.5165436, lng: 73.8366021 };
const destination = { id: "hinjawadi-phase-1", label: "Hinjawadi Phase 1, Pune", lat: 18.5879348, lng: 73.7372748 };
const routeResponse = await fetch("https://30hours.dpratik3005.workers.dev/api/route", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ origin, destination, mode: "DRIVE" }),
});
const routeData = await routeResponse.json();
if (!routeResponse.ok || !routeData.trips?.length) throw new Error("Could not retrieve the Pune demo route.");

const manifestPath = new URL("../public/demo/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const route = routeData.trips[0];
manifest.label = "Prepared Pune demo - illustrative 40-minute drive, four-minute sample listen";
manifest.trip = {
  ...route,
  id: "pune-deccan-hinjawadi",
  origin,
  destination,
  durationSeconds: 40 * 60,
  arrivalTime: 0,
  demo: true,
  summary: "Deccan Gymkhana to Hinjawadi via Aundh-Wakad Road",
  warnings: ["Illustrative 40-minute demo timing; live drive times vary."],
};
const openingScripts = {
  en: "On the Pune drive from Deccan Gymkhana to Hinjawadi Phase One, a signal turns red. Before you decide to check your phone, your hand is already reaching for it. That tiny impulse is our subject. Over this forty-minute commute, let us explore what a little space between inputs can do.",
  hi: "पुणे में डेक्कन जिमखाना से हिंजेवाड़ी फेज़ वन की करीब चालीस मिनट की ड्राइव पर अगला सिग्नल लाल होता है। फोन देखने का फैसला करने से पहले ही हाथ फोन की तरफ बढ़ जाता है। आज इसी छोटी आदत की बात करेंगे: हर खाली पल भरने के बजाय, थोड़ा विराम लेने से ध्यान पर क्या बदलता है?",
  hinglish: "Pune ke Deccan Gymkhana se Hinjawadi Phase One tak, yeh around forty-minute commute hai. Agla signal red hota hai aur phone check karne ka decision lene se pehle hi haath phone ki taraf chala jaata hai. Aaj isi tiny impulse ko explore karte hain; har pause mein content bharne ke bajay thoda space chhodne se attention par kya badalta hai?",
};
const descriptions = {
  en: "A four-minute prepared sample about attention and everyday pauses, set on a forty-minute Pune commute.",
  hi: "चार मिनट का तैयार sample, Pune की करीब चालीस मिनट की drive पर attention और रोज़मर्रा के विरामों की बात.",
  hinglish: "Pune ki forty-minute commute par attention aur everyday pauses ke baare mein four-minute prepared sample.",
};
for (const [language, script] of Object.entries(openingScripts)) {
  manifest.plans[language].description = descriptions[language];
  manifest.plans[language].chunks.find(chunk => chunk.id === "opening").script = script;
  manifest.audio[language].find(audio => audio.id === "opening").spokenTranscript = script;
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Saved Pune demo route: ${Math.round(route.durationSeconds / 60)} minute live estimate, ${(route.distanceMeters / 1000).toFixed(1)} km.`);
