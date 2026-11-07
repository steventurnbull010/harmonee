// ============================================================================
// WEATHER CARD (js/weather-card.js), on Today at a glance
// Now, the next few hours, tomorrow, and a line or two a family can act on:
// "Rain likely from 3pm: coats for the school run", "Dry until this evening:
// good for the washing", "Frost tonight: defrost the car in the morning".
// Uses the forecast js/weather.js already fetches (Open-Meteo: free, no key).
//
//   WeatherCard.html()                 -> the card ("" when there's no weather)
//   WeatherCard.hints(forecast, now)   -> [{ icon, text }] (pure, for testing)
// ============================================================================
(function (root) {
  const esc = (s) => (root.escapeHtml ? root.escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const pad = (n) => String(n).padStart(2, "0");
  const hourKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeText = (h) => (h === 0 ? "midnight" : h === 12 ? "midday" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`);
  const shortTime = (h) => (h === 0 ? "12am" : h === 12 ? "12pm" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`);
  const deg = (t) => `${Math.round(t)}°`;

  const RAINY = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
  const SNOWY = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
  const STORMY = (c) => c >= 95;

  function info(code, isDay) {
    const map = typeof weatherMap !== "undefined" ? weatherMap : {};
    const i = map[code] || { icon: "☁️", text: "Cloudy" };
    const icon = !isDay && (code === 0 || code === 1) ? "🌙" : i.icon;
    const text = i.text.charAt(0) + i.text.slice(1).toLowerCase(); // "Partly cloudy"
    return { icon, text };
  }

  // Hours of the forecast between two times: [{ date, hour, temp, rain, code, isDay, wind }]
  function hoursBetween(f, from, to) {
    const h = f && f.hourly;
    if (!h || !Array.isArray(h.time)) return [];
    const out = [];
    h.time.forEach((t, i) => {
      const [d, hh] = t.split("T");
      const [y, m, day] = d.split("-").map(Number);
      const date = new Date(y, m - 1, day, Number(hh.slice(0, 2)));
      if (date < from || date >= to) return;
      out.push({ date, hour: date.getHours(), temp: h.temperature_2m[i], rain: (h.precipitation_probability || [])[i] || 0, code: (h.weathercode || [])[i] || 0, isDay: (h.is_day || [])[i] !== 0, wind: (h.wind_speed_10m || [])[i] || 0 });
    });
    return out;
  }
  function dayOf(f, date) {
    const d = f && f.daily;
    if (!d || !Array.isArray(d.time)) return null;
    const i = d.time.indexOf(dayKey(date));
    if (i < 0) return null;
    return { max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: (d.precipitation_probability_max || [])[i] || 0, code: (d.weathercode || [])[i] || 0, uv: (d.uv_index_max || [])[i] || 0 };
  }

  // ---- What a family wants to know -------------------------------------------------
  // Daytime: the rest of today. From 6pm: overnight and tomorrow.
  function hints(f, now = new Date()) {
    if (!f || !f.hourly) return [];
    const out = [];
    const add = (icon, text) => { if (out.length < 2 && !out.some(o => o.text === text)) out.push({ icon, text }); };
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const evening = now.getHours() >= 18;
    const thisHour = new Date(now); thisHour.setMinutes(0, 0, 0);
    const schoolDay = (d) => d.getDay() >= 1 && d.getDay() <= 5;

    // The stretch we're talking about
    const from = evening ? new Date(tomorrow.getTime() + 7 * 3600000) : thisHour;
    const to = evening ? new Date(tomorrow.getTime() + 21 * 3600000) : new Date(today.getTime() + 21 * 3600000);
    const span = hoursBetween(f, from, to);
    const when = (h) => evening ? `tomorrow ${h.hour < 12 ? "morning" : h.hour < 17 ? "afternoon" : "evening"}` : `from ${timeText(h.hour)}`;
    const day = evening ? dayOf(f, tomorrow) : dayOf(f, today);
    const overnight = hoursBetween(f, evening ? now : new Date(today.getTime() + 18 * 3600000), new Date(tomorrow.getTime() + 9 * 3600000));

    // Snow and storms first
    const snow = span.find(h => SNOWY(h.code) && h.rain >= 40);
    if (snow) add("⛄", `Snow possible ${when(snow)}`);
    const storm = span.find(h => STORMY(h.code));
    if (storm) add("⛈️", `Thunderstorms possible ${when(storm)}`);

    // Rain
    const wet = (h) => h.rain >= 50;
    if (span.length) {
      const wetNow = !evening && wet(span[0]) && RAINY(span[0].code);
      if (wetNow) {
        const dry = span.findIndex((h, i) => i > 0 && !wet(h) && span[i + 1] && !wet(span[i + 1]));
        add("☔", dry > 0 ? `Wet until ${timeText(span[dry].hour)}, then drier` : "Wet for the rest of the day: coats on");
      } else {
        const first = span.find(wet);
        if (first) {
          const pickup = schoolDay(first.date) && first.hour >= 14 && first.hour <= 16;
          const morningRun = evening && schoolDay(first.date) && first.hour >= 7 && first.hour <= 9;
          add("☔", `Rain likely ${when(first)}: ${pickup || morningRun ? "coats for the school run" : "take a coat"}`);
        }
      }
    }

    // Frost and cold
    const coldest = overnight.length ? Math.min(...overnight.map(h => h.temp)) : null;
    if (coldest !== null && coldest <= 1) add("❄️", `Frost ${evening ? "tonight" : "overnight"} (${deg(coldest)}): defrost the car in the morning`);
    if (day && day.max <= 4) add("🧤", `Cold ${evening ? "tomorrow" : "all day"} (top of ${deg(day.max)}): hats and gloves`);

    // Wind
    const gusty = span.reduce((a, h) => (h.wind > (a ? a.wind : 0) ? h : a), null);
    if (gusty && gusty.wind >= 30) add("💨", `Very windy ${when(gusty)} (${Math.round(gusty.wind)} mph): bring the bins in`);

    // Warm and sunny
    if (day && day.max >= 23) add("🧴", `Warm ${evening ? "tomorrow" : "today"} (${deg(day.max)}): sun cream and water bottles`);
    else if (day && day.uv >= 6) add("🧴", `Strong sun ${evening ? "tomorrow" : "today"}: sun cream`);

    // A good drying day
    const daylightLeft = span.filter(h => h.isDay);
    if (!out.length && day && day.max >= 8 && daylightLeft.length >= 3 && daylightLeft.every(h => h.rain < 20)) {
      add("👕", evening ? "Dry tomorrow: a good day for the washing" : "Dry until this evening: good for the washing");
    }
    return out;
  }

  // ---- The card ---------------------------------------------------------------------
  function html(now = new Date()) {
    const f = typeof root.getWeatherForecast === "function" ? root.getWeatherForecast() : null;
    const cw = f && f.current;
    if (!cw) return "";
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nowInfo = info(cw.weathercode, cw.is_day);
    const td = dayOf(f, today);
    const tm = dayOf(f, tomorrow);
    const thisHour = new Date(now); thisHour.setMinutes(0, 0, 0);
    const next = hoursBetween(f, new Date(thisHour.getTime() + 3600000), new Date(thisHour.getTime() + 7 * 3600000));
    const tips = hints(f, now);
    const place = String(f.city || "").split(",")[0];

    return `<section class="today-card today-weather-card" aria-labelledby="today-weather-title">
      <div class="wx-head">
        <h3 class="today-card-title" id="today-weather-title">🌦️ Weather</h3>
        ${place ? `<span class="wx-place">${esc(place)}</span>` : ""}
      </div>
      <div class="wx-now">
        <span class="wx-now-icon" aria-hidden="true">${nowInfo.icon}</span>
        <span class="wx-now-temp">${deg(cw.temperature)}</span>
        <span class="wx-now-text"><strong>${esc(nowInfo.text)}</strong>${td ? `<span>High ${deg(td.max)} · Low ${deg(td.min)}</span>` : ""}</span>
      </div>
      ${tips.length ? `<ul class="wx-tips">${tips.map(t => `<li><span aria-hidden="true">${t.icon}</span> ${esc(t.text)}</li>`).join("")}</ul>` : ""}
      ${next.length ? `<ol class="wx-hours" aria-label="The next few hours">${next.map(h => {
        const i = info(h.code, h.isDay);
        return `<li class="wx-hour" aria-label="${shortTime(h.hour)}: ${esc(i.text)}, ${deg(h.temp)}${h.rain >= 20 ? `, ${h.rain}% chance of rain` : ""}">
          <span class="wx-hour-time">${shortTime(h.hour)}</span>
          <span class="wx-hour-icon" aria-hidden="true">${i.icon}</span>
          <span class="wx-hour-temp">${deg(h.temp)}</span>
          <span class="wx-hour-rain${h.rain >= 50 ? " is-likely" : ""}">${h.rain >= 20 ? `💧${h.rain}%` : ""}</span>
        </li>`;
      }).join("")}</ol>` : ""}
      ${tm ? `<p class="wx-tomorrow"><span>Tomorrow</span> <span aria-hidden="true">${info(tm.code, true).icon}</span> ${deg(tm.max)} / ${deg(tm.min)}${tm.rain >= 20 ? ` · 💧${tm.rain}% rain` : ""}</p>` : ""}
    </section>`;
  }

  const api = { html, hints };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WeatherCard = api;
})(typeof window !== "undefined" ? window : globalThis);
