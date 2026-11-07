#!/usr/bin/env node
// Checks the weather card's family hints (js/weather-card.js) on made-up forecasts.
// Run: node scripts/test-weather.js
const W = require("../js/weather-card.js");
const pad = (n) => String(n).padStart(2, "0");

// A forecast from Mon 9 Nov 2026 for 3 days; each hour from fn(date, hour)
function forecast(fn, daily = {}) {
  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], weathercode: [], is_day: [], wind_speed_10m: [] };
  for (let d = 0; d < 3; d++) for (let h = 0; h < 24; h++) {
    const date = new Date(2026, 10, 9 + d, h);
    const v = { temp: 10, rain: 0, code: 2, wind: 8, ...fn(date, h, d) };
    hourly.time.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(h)}:00`);
    hourly.temperature_2m.push(v.temp); hourly.precipitation_probability.push(v.rain);
    hourly.weathercode.push(v.code); hourly.is_day.push(h >= 7 && h < 17 ? 1 : 0); hourly.wind_speed_10m.push(v.wind);
  }
  const days = [0, 1, 2].map(d => new Date(2026, 10, 9 + d));
  const temps = (d) => hourly.temperature_2m.slice(d * 24, d * 24 + 24);
  return {
    current: { temperature: 10, weathercode: 2, is_day: 1 },
    hourly,
    daily: {
      time: days.map(x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`),
      temperature_2m_max: [0, 1, 2].map(d => Math.max(...temps(d))),
      temperature_2m_min: [0, 1, 2].map(d => Math.min(...temps(d))),
      precipitation_probability_max: [0, 1, 2].map(() => 0),
      weathercode: [2, 2, 2],
      uv_index_max: daily.uv || [1, 1, 1]
    }
  };
}
const at = (h, d = 0) => new Date(2026, 10, 9 + d, h, 20); // Monday 9 Nov

const CASES = [
  ["Rain at 3pm on a school day", forecast((dt, h, d) => (d === 0 && h >= 15 ? { rain: 80, code: 63 } : {})), at(10), ["☔ Rain likely from 3pm: coats for the school run"]],
  ["Rain at 7pm", forecast((dt, h, d) => (d === 0 && h >= 19 ? { rain: 70, code: 61 } : {})), at(10), ["☔ Rain likely from 7pm: take a coat"]],
  ["Wet now, dry from 1pm", forecast((dt, h, d) => (d === 0 && h < 13 ? { rain: 90, code: 63 } : {})), at(9), ["☔ Wet until 1pm, then drier"]],
  ["Dry, mild day", forecast(() => ({ temp: 12 })), at(9), ["👕 Dry until this evening: good for the washing"]],
  ["Frost tonight", forecast((dt, h, d) => ((d === 0 && h >= 20) || (d === 1 && h < 8) ? { temp: -2 } : { temp: 6 })), at(10), ["❄️ Frost overnight (-2°): defrost the car in the morning"]],
  ["Freezing day", forecast(() => ({ temp: 2 })), at(9), ["❄️ Frost overnight (2°): defrost the car in the morning"].slice(0, 0).concat(["🧤 Cold all day (top of 2°): hats and gloves"])],
  ["Windy afternoon", forecast((dt, h, d) => (d === 0 && h === 15 ? { wind: 42 } : {})), at(10), ["💨 Very windy from 3pm (42 mph): bring the bins in"]],
  ["Hot day", forecast((dt, h) => ({ temp: h > 10 && h < 18 ? 26 : 16 })), at(9), ["🧴 Warm today (26°): sun cream and water bottles"]],
  ["Evening: rain tomorrow morning", forecast((dt, h, d) => (d === 1 && h >= 8 && h <= 10 ? { rain: 80, code: 61 } : {})), at(19), ["☔ Rain likely tomorrow morning: coats for the school run"]],
  ["Evening: dry tomorrow", forecast(() => ({ temp: 11 })), at(19), ["👕 Dry tomorrow: a good day for the washing"]],
  ["Snow later", forecast((dt, h, d) => (d === 0 && h >= 16 ? { rain: 70, code: 73, temp: 0 } : { temp: 1 })), at(10), ["⛄ Snow possible from 4pm"]],
  ["Nothing to say: cloudy, cold-ish", forecast((dt, h, d) => ({ temp: 6, rain: 30 })), at(10), []]
];

let pass = 0, fail = 0;
CASES.forEach(([name, f, now, want]) => {
  const got = W.hints(f, now).map(h => `${h.icon} ${h.text}`);
  const ok = want.every((w, i) => got[i] === w) && (want.length || !got.length);
  if (ok) pass++; else { fail++; console.log(`✗ ${name}\n    wanted ${JSON.stringify(want)}\n    got    ${JSON.stringify(got)}`); }
});
console.log(`\n${pass} passed, ${fail} failed (${CASES.length} forecasts)`);
process.exit(fail ? 1 : 0);
