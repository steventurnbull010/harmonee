// ============================================================================
// REAL-TIME LOCAL WEATHER & 5-DAY FORECAST (js/weather-sleep.js)
// Unified weather provider for Calendar, Tasks, Meals and Forecast Dialog
// ============================================================================

const weatherMap = {
  0: { icon: "☀️", text: "Clear Sky" },
  1: { icon: "🌤️", text: "Mainly Clear" },
  2: { icon: "⛅", text: "Partly Cloudy" },
  3: { icon: "☁️", text: "Overcast" },
  45: { icon: "🌫️", text: "Foggy" },
  48: { icon: "🌫️", text: "Depositing Rime Fog" },
  51: { icon: "🌦️", text: "Light Drizzle" },
  53: { icon: "🌦️", text: "Drizzle" },
  55: { icon: "🌧️", text: "Heavy Drizzle" },
  56: { icon: "🌨️", text: "Freezing Drizzle" },
  57: { icon: "🌨️", text: "Dense Freezing Drizzle" },
  61: { icon: "🌧️", text: "Slight Rain" },
  63: { icon: "🌧️", text: "Rain" },
  65: { icon: "🌧️", text: "Heavy Rain" },
  66: { icon: "🌨️", text: "Freezing Rain" },
  67: { icon: "🌨️", text: "Heavy Freezing Rain" },
  71: { icon: "🌨️", text: "Light Snow" },
  73: { icon: "🌨️", text: "Snow" },
  75: { icon: "❄️", text: "Heavy Snow" },
  77: { icon: "❄️", text: "Snow Grains" },
  80: { icon: "🌧️", text: "Slight Showers" },
  81: { icon: "🌧️", text: "Showers" },
  82: { icon: "⛈️", text: "Violent Showers" },
  85: { icon: "🌨️", text: "Snow Showers" },
  86: { icon: "❄️", text: "Heavy Snow Showers" },
  95: { icon: "⛈️", text: "Thunderstorm" },
  96: { icon: "⛈️", text: "Thunderstorm with Hail" },
  99: { icon: "⛈️", text: "Severe Thunderstorm" }
};

let localWeatherForecast = null;

// ---------------------------------------------------------------------------
// WHERE THE WEATHER IS FOR
// One place for the whole board (boardSettings.weatherLocation =
// { lat, lon, name }), chosen in the guided setup or Settings > Display:
// this device's location, or a town typed in. Only a rough position is kept
// (rounded to 0.1 degrees, roughly 10 km), and it's only sent to the weather
// service. With no place set, a device that has *already* allowed location
// uses its own; otherwise there's simply no weather (never a guessed city,
// and no surprise "wants to know your location" pop-up).
// ---------------------------------------------------------------------------
const roundCoord = (x) => Math.round(Number(x) * 10) / 10;
const validPlace = (p) => !!p && isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
const placeKey = (p) => (p ? `${roundCoord(p.lat)},${roundCoord(p.lon)}` : "");

function fromDevice(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This device can't share its location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude), name: "Your area" }),
      (err) => reject(new Error(err && err.code === 1 ? "Location wasn't allowed. You can type your town instead." : "Couldn't find this device's location. Try typing your town.")),
      { timeout: timeoutMs, maximumAge: 30 * 60 * 1000, enableHighAccuracy: false }
    );
  });
}

// Open-Meteo's free place search: "Bangor" -> Bangor, Northern Ireland, ...
async function searchTowns(q) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  if (!res.ok) throw new Error("search failed");
  const data = await res.json();
  return (data.results || []).map(r => ({
    lat: roundCoord(r.latitude),
    lon: roundCoord(r.longitude),
    name: r.name,
    label: [r.name, r.admin1, r.country].filter((v, i, a) => v && a.indexOf(v) === i).join(", ")
  }));
}

async function resolveWeatherPlace() {
  const chosen = (window.boardSettings || {}).weatherLocation;
  if (validPlace(chosen)) return chosen;
  if (chosen === false) return null; // weather switched off for this board
  try {
    if (navigator.permissions && navigator.geolocation) {
      const st = await navigator.permissions.query({ name: "geolocation" });
      if (st.state === "granted") return await fromDevice(6000);
    }
  } catch (e) {}
  return null;
}

// A small "where are you?" control, used by the guided setup and Settings.
//   renderWeatherPlacePicker(container, { current, onPick(place|null), offLabel })
function renderWeatherPlacePicker(box, opts = {}) {
  if (!box) return;
  const esc = (v) => (typeof window.escapeHtml === "function" ? window.escapeHtml(String(v)) : String(v));
  let results = [];
  let message = "";
  let busy = false;
  let current = validPlace(opts.current) ? opts.current : null;

  const draw = () => {
    box.innerHTML = current
      ? `<div class="wx-picked">
          <span class="wx-picked-name">📍 ${esc(current.label || current.name || "Your area")}</span>
          <button type="button" class="wx-link" data-wx="change">Change</button>
          ${opts.offLabel ? `<button type="button" class="wx-link is-quiet" data-wx="off">${esc(opts.offLabel)}</button>` : ""}
        </div>`
      : `<div class="wx-pick">
          <button type="button" class="wx-device" data-wx="device" ${busy ? "disabled" : ""}><span aria-hidden="true">📍</span> ${busy ? "Finding you…" : "Use this device's location"}</button>
          <div class="wx-or"><span>or type your town</span></div>
          <div class="wx-search">
            <input type="text" class="wx-input" placeholder="e.g. Bangor" aria-label="Your town" autocomplete="off" enterkeyhint="search">
            <button type="button" class="wx-find" data-wx="find">Find</button>
          </div>
          ${results.length ? `<ul class="wx-results">${results.map((r, i) => `<li><button type="button" class="wx-result" data-wx="pick" data-i="${i}">${esc(r.label)}</button></li>`).join("")}</ul>` : ""}
          <p class="wx-note">${message ? esc(message) : "Only your rough area (about 10 km) is kept, just to fetch the weather."}</p>
        </div>`;
  };
  const choose = (place) => { current = place; results = []; message = ""; draw(); if (typeof opts.onPick === "function") opts.onPick(place); };
  const find = async () => {
    const input = box.querySelector(".wx-input");
    const q = input && input.value.trim();
    if (!q) return;
    message = "Searching…"; draw(); box.querySelector(".wx-input").value = q;
    try {
      results = await searchTowns(q);
      message = results.length ? "Tap your town:" : `No places called "${q}". Try a nearby town.`;
    } catch (e) { results = []; message = "Couldn't search just now. Check the connection."; }
    draw();
    const again = box.querySelector(".wx-input"); if (again) again.value = q;
  };

  box.onclick = async (e) => {
    const b = e.target.closest("[data-wx]");
    if (!b) return;
    const act = b.getAttribute("data-wx");
    if (act === "change") { current = null; draw(); return; }
    if (act === "off") { choose(null); return; }
    if (act === "find") { find(); return; }
    if (act === "pick") { const r = results[parseInt(b.getAttribute("data-i"), 10)]; if (r) choose(r); return; }
    if (act === "device") {
      busy = true; message = ""; draw();
      try { const p = await fromDevice(); busy = false; choose(p); }
      catch (err) { busy = false; message = err.message; draw(); }
    }
  };
  box.onkeydown = (e) => { if (e.key === "Enter" && e.target.classList.contains("wx-input")) { e.preventDefault(); e.stopPropagation(); find(); } };
  draw();
}

// Settings > Display > Weather location (whole board; saves straight away)
function renderWeatherSettings() {
  const box = document.getElementById("weather-settings");
  if (!box) return;
  const current = (window.boardSettings || {}).weatherLocation;
  renderWeatherPlacePicker(box, {
    current,
    offLabel: "Turn off weather",
    onPick: async (place) => {
      // null from "Turn off weather" is saved as false: off for every device
      const value = place ? { lat: place.lat, lon: place.lon, name: place.name, label: place.label || place.name } : false;
      if (typeof window.saveBoardSettingsNow === "function") await window.saveBoardSettingsNow({ weatherLocation: value });
      initLocalWeather();
    }
  });
}

window.WeatherPlace = { fromDevice, searchTowns, renderWeatherPlacePicker, roundCoord };
window.renderWeatherSettings = renderWeatherSettings;

// No place: no weather on the headers (rather than a guessed city)
function hideLocalWeather() {
  document.querySelectorAll("#calendar-weather-badge, #tasks-weather-badge, .calendar-weather-badge").forEach(b => { b.textContent = ""; b.title = ""; b.onclick = null; b.style.cursor = ""; });
  const mealsWeatherEl = document.getElementById("meals-header-time-weather");
  if (mealsWeatherEl) mealsWeatherEl.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  localWeatherForecast = null;
}

async function initLocalWeather() {
  const badgeElements = document.querySelectorAll("#calendar-weather-badge, #tasks-weather-badge, .calendar-weather-badge");
  const mealsWeatherEl = document.getElementById("meals-header-time-weather");

  const applyWeather = (temp, code, isDay, city) => {
    const info = weatherMap[code] || { icon: isDay ? "🌤️" : "☁️", text: "Cloudy" };
    let icon = info.icon;
    if (code === 0 && !isDay) icon = "🌙";
    const rounded = Math.round(temp);

    badgeElements.forEach(badge => {
      badge.innerHTML = icon + " " + rounded + "°";
      badge.title = info.text + " • " + (city ? city + " • " : "") + rounded + "°C. Click for 5-Day Forecast.";
      badge.style.cursor = "pointer";
      badge.onclick = (e) => {
        e.stopPropagation();
        openWeatherForecastModal();
      };
    });

    if (mealsWeatherEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      mealsWeatherEl.textContent = timeStr + " • " + icon + " " + rounded + "°";
      mealsWeatherEl.title = "Click for 5-Day Forecast";
      mealsWeatherEl.style.cursor = "pointer";
      mealsWeatherEl.onclick = (e) => {
        e.stopPropagation();
        openWeatherForecastModal();
      };
    }
  };

  const place = await resolveWeatherPlace();
  if (!place) { hideLocalWeather(); return; }
  const thisPlace = placeKey(place);

  // 1. Instant cache restore if available, fresh (< 2 hours) and for this place
  try {
    const cached = localStorage.getItem("turnbull_weather_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000 && parsed.place === thisPlace) {
        applyWeather(parsed.temp, parsed.code, parsed.isDay, parsed.city);
      }
    }
    const cachedForecast = localStorage.getItem("turnbull_weather_forecast");
    if (cachedForecast) {
      const f = JSON.parse(cachedForecast);
      if (f && f.place === thisPlace) localWeatherForecast = f;
    }
  } catch (e) {}

  // 2. Weather Fetcher with reliable fallback
  async function fetchWeather(lat, lon, city) {
    city = city || "";
    let success = false;

    // Strategy A: Open-Meteo
    try {
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon + "&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto");
      if (res.ok) {
        const data = await res.json();
        if (data && data.current_weather) {
          const cw = data.current_weather;
          applyWeather(cw.temperature, cw.weathercode, cw.is_day, city);
          localWeatherForecast = {
            city: city,
            current: cw,
            daily: data.daily || null,
            place: thisPlace,
            timestamp: Date.now()
          };
          localStorage.setItem("turnbull_weather_cache", JSON.stringify({
            temp: cw.temperature,
            code: cw.weathercode,
            isDay: cw.is_day,
            city: city,
            place: thisPlace,
            timestamp: Date.now()
          }));
          localStorage.setItem("turnbull_weather_forecast", JSON.stringify(localWeatherForecast));
          success = true;
        }
      }
    } catch (err) {
      console.warn("Open-Meteo error:", err);
    }

    // Strategy B: wttr.in fallback
    if (!success) {
      try {
        const query = city ? encodeURIComponent(city) : (lat + "," + lon);
        const res = await fetch("https://wttr.in/" + query + "?format=j1");
        if (res.ok) {
          const data = await res.json();
          if (data && data.current_condition && data.current_condition[0]) {
            const cur = data.current_condition[0];
            const temp = parseFloat(cur.temp_C);
            const desc = (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || "Cloudy";
            let code = 2;
            const lowerDesc = desc.toLowerCase();
            if (lowerDesc.includes("clear") || lowerDesc.includes("sun")) code = 0;
            else if (lowerDesc.includes("overcast")) code = 3;
            else if (lowerDesc.includes("rain") || lowerDesc.includes("drizzle") || lowerDesc.includes("shower")) code = 61;
            else if (lowerDesc.includes("snow")) code = 71;
            else if (lowerDesc.includes("thunder")) code = 95;

            const isDay = 1;
            applyWeather(temp, code, isDay, city);

            const dailyTime = [];
            const dailyMax = [];
            const dailyMin = [];
            const dailyCode = [];
            const dailyRain = [];

            if (Array.isArray(data.weather)) {
              data.weather.slice(0, 5).forEach(day => {
                dailyTime.push(day.date);
                dailyMax.push(parseFloat(day.maxtempC || temp));
                dailyMin.push(parseFloat(day.mintempC || temp));
                dailyCode.push(code);
                dailyRain.push(parseInt(day.hourly && day.hourly[0] && day.hourly[0].chanceofrain || 0));
              });
            }

            localWeatherForecast = {
              city: city,
              current: { temperature: temp, weathercode: code, is_day: 1 },
              daily: {
                time: dailyTime,
                temperature_2m_max: dailyMax,
                temperature_2m_min: dailyMin,
                weathercode: dailyCode,
                precipitation_probability_max: dailyRain
              },
              place: thisPlace,
              timestamp: Date.now()
            };

            localStorage.setItem("turnbull_weather_cache", JSON.stringify({
              temp: temp,
              code: code,
              isDay: isDay,
              city: city,
              place: thisPlace,
              timestamp: Date.now()
            }));
            localStorage.setItem("turnbull_weather_forecast", JSON.stringify(localWeatherForecast));
            success = true;
          }
        }
      } catch (err) {
        console.warn("wttr fallback error:", err);
      }
    }

    if (typeof renderWeekCalendar === "function" && window.currentCalendarView === "week") {
      try { renderWeekCalendar(); } catch (e) {}
    }
  }

  await fetchWeather(place.lat, place.lon, place.label || place.name);
}
window.initLocalWeather = initLocalWeather;

function getForecastForDate(dateOrDateStr) {
  if (!localWeatherForecast) {
    try {
      const cached = localStorage.getItem("turnbull_weather_forecast");
      if (cached) localWeatherForecast = JSON.parse(cached);
    } catch (e) {}
  }
  const wf = localWeatherForecast;
  if (!wf || !wf.daily || !Array.isArray(wf.daily.time)) return null;

  const targetKey = typeof dateOrDateStr === "string" ? dateOrDateStr : (dateOrDateStr.toISOString ? dateOrDateStr.toISOString().split("T")[0] : "");
  const idx = wf.daily.time.indexOf(targetKey);
  if (idx === -1) return null;

  const code = wf.daily.weathercode ? wf.daily.weathercode[idx] : 0;
  const info = weatherMap[code] || { icon: "🌤️", text: "Partly Cloudy" };
  const max = (wf.daily.temperature_2m_max && wf.daily.temperature_2m_max[idx] !== undefined)
    ? Math.round(wf.daily.temperature_2m_max[idx]) : null;
  const min = (wf.daily.temperature_2m_min && wf.daily.temperature_2m_min[idx] !== undefined)
    ? Math.round(wf.daily.temperature_2m_min[idx]) : null;
  const rain = (wf.daily.precipitation_probability_max && wf.daily.precipitation_probability_max[idx] !== undefined)
    ? wf.daily.precipitation_probability_max[idx] : 0;

  return {
    icon: info.icon,
    condition: info.text,
    maxTemp: max,
    minTemp: min,
    rainProb: rain
  };
}
window.getForecastForDate = getForecastForDate;

function openWeatherForecastModal() {
  const modal = document.getElementById("weather-forecast-modal");
  if (!modal) return;

  const locEl = document.getElementById("weather-modal-location");
  const heroIcon = document.getElementById("weather-modal-hero-icon");
  const heroTemp = document.getElementById("weather-hero-temp");
  const heroCond = document.getElementById("weather-hero-condition");
  const heroRange = document.getElementById("weather-hero-range");
  const heroRain = document.getElementById("weather-hero-rain");
  const heroUpdated = document.getElementById("weather-hero-updated");
  const listEl = document.getElementById("weather-forecast-list");

  if (!localWeatherForecast) {
    try {
      const cached = localStorage.getItem("turnbull_weather_forecast");
      if (cached) localWeatherForecast = JSON.parse(cached);
    } catch (e) {}
  }

  const wf = localWeatherForecast;
  if (locEl) locEl.textContent = "📍 " + (wf && wf.city ? wf.city : "Belfast, UK");

  if (wf && wf.current) {
    const code = wf.current.weathercode;
    const info = weatherMap[code] || { icon: "🌤️", text: "Partly Cloudy" };
    if (heroIcon) heroIcon.textContent = info.icon;
    if (heroTemp) heroTemp.textContent = Math.round(wf.current.temperature) + "°";
    if (heroCond) heroCond.textContent = info.text;
  }

  if (heroUpdated && wf && wf.timestamp) {
    const minsAgo = Math.max(0, Math.round((Date.now() - wf.timestamp) / 60000));
    heroUpdated.textContent = minsAgo === 0 ? "Updated Just Now" : ("Updated " + minsAgo + "m ago");
  }

  if (wf && wf.daily && Array.isArray(wf.daily.time) && wf.daily.time.length > 0) {
    const todayMax = Math.round(wf.daily.temperature_2m_max[0]);
    const todayMin = Math.round(wf.daily.temperature_2m_min[0]);
    const todayRain = wf.daily.precipitation_probability_max ? wf.daily.precipitation_probability_max[0] : 0;
    if (heroRange) heroRange.textContent = "High: " + todayMax + "° • Low: " + todayMin + "°";
    if (heroRain) heroRain.textContent = "💧 " + (todayRain || 0) + "% Rain";

    if (listEl) {
      listEl.innerHTML = "";
      const daysCount = Math.min(5, wf.daily.time.length);
      for (let i = 0; i < daysCount; i++) {
        const dateStr = wf.daily.time[i];
        const dObj = new Date(dateStr + "T12:00:00");
        const dayLabel = i === 0 ? "Today" : dObj.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
        const code = wf.daily.weathercode ? wf.daily.weathercode[i] : 0;
        const info = weatherMap[code] || { icon: "🌤️", text: "Mainly Clear" };
        const max = Math.round(wf.daily.temperature_2m_max[i]);
        const min = Math.round(wf.daily.temperature_2m_min[i]);
        const rainProb = wf.daily.precipitation_probability_max ? wf.daily.precipitation_probability_max[i] : 0;

        const row = document.createElement("div");
        row.className = "weather-day-row";
        row.innerHTML = "<div class=\"weather-day-name\">" + dayLabel + "</div>" +
          "<div class=\"weather-day-condition-wrap\">" +
            "<span class=\"weather-day-icon\">" + info.icon + "</span>" +
            "<span class=\"weather-day-desc\">" + info.text + "</span>" +
          "</div>" +
          "<div class=\"weather-day-metrics\">" +
            "<span class=\"weather-day-rain\">💧 " + rainProb + "%</span>" +
            "<div class=\"weather-day-temp-bar\">" +
              "<span class=\"weather-temp-min\">" + min + "°</span>" +
              "<span>/</span>" +
              "<span class=\"weather-temp-max\">" + max + "°</span>" +
            "</div>" +
          "</div>";
        listEl.appendChild(row);
      }
    }
  }

  const closeModal = () => {
    if (modal.open) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  };

  const btnClose = document.getElementById("btn-close-weather-modal");
  const btnDone = document.getElementById("btn-done-weather");
  const btnRefresh = document.getElementById("btn-refresh-weather");
  if (btnClose) btnClose.onclick = closeModal;
  if (btnDone) btnDone.onclick = closeModal;
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.innerHTML = "<span>🔄 Refreshing...</span>";
      await initLocalWeather();
      btnRefresh.innerHTML = "<span>🔄 Refresh Weather</span>";
      openWeatherForecastModal();
    };
  }

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "true");
}
window.openWeatherForecastModal = openWeatherForecastModal;

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLocalWeather);
} else {
  initLocalWeather();
}
