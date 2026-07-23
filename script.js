function ageGroup(a) {
  if (a == null) return "Unknown";
  if (a < 50) return "<50";
  if (a < 60) return "50-59";
  if (a < 70) return "60-69";
  if (a < 80) return "70-79";
  return "80+";
}
function normalizeHistology(raw) {
  if (!raw) return "Unknown";
  const value = String(raw).toLowerCase();
  if (value.includes("squamous")) return "Squamous Cell Carcinoma";
  if (value.includes("adenocarcinoma")) return "Adenocarcinoma";
  return raw;
}
function normalizeStage(raw) {
  if (!raw) return "Unknown";
  const v = String(raw).toUpperCase();
  if (/\bIV\b|\bIVA\b|\b4\b/.test(v) || /IV/.test(v)) return "Stage IV";
  if (/\bIII\b|\b3\b/.test(v) || /III/.test(v)) return "Stage III";
  if (/\bII\b|\b2\b/.test(v) || /\bIIB\b|\bIIA\b|\bII\b/.test(v))
    return "Stage II";
  if (/\bI\b|\b1\b/.test(v) || /\bIA\b|\bIB\b/.test(v)) return "Stage I";
  const m = v.match(/STAGE\s*([IVXLCDM]+)/i);
  if (m) {
    const s = m[1];
    if (/IV/.test(s)) return "Stage IV";
    if (/III/.test(s)) return "Stage III";
    if (/II/.test(s)) return "Stage II";
    if (/I\b/.test(s)) return "Stage I";
  }
  return "Unknown";
}
function normalizeGender(raw) {
  if (!raw) return "Unknown";
  const value = String(raw).trim().toLowerCase();
  if (value === "male" || value === "m") return "Male";
  if (value === "female" || value === "f") return "Female";
  return raw;
}
function smokingHistory(value) {
  if (value == null) return "Unknown";
  if (value === 0) return "Never smoked";
  if (value < 20) return "<20 pack-years";
  if (value < 40) return "20-39 pack-years";
  return "40+ pack-years";
}
let DATA = { records: [] };
d3.csv("Esophageal_Dataset_Cleaned.csv", (d) => {
  const parsed = d3.autoType(d);
  return {
    id: parsed.patient_barcode,
    gender: normalizeGender(parsed.gender),
    age: parsed.primary_pathology_age_at_initial_pathologic_diagnosis,
    stage_raw: parsed.stage_event_pathologic_stage,
    stage: normalizeStage(parsed.stage_event_pathologic_stage),
    histology: normalizeHistology(parsed.primary_pathology_histological_type),
    vital: parsed.vital_status,
    smoker: smokingHistory(parsed.number_pack_years_smoked),
    pack_years: parsed.number_pack_years_smoked,
    lymph_examined:
      parsed.primary_pathology_number_of_lymphnodes_positive_by_he,
    country: parsed.country_of_procurement,
    city: parsed.city_of_procurement,
    grade: parsed.grade || "Unknown",
    bmi: parsed.bmi ?? null,
    survival_months: parsed.survival_months ?? null,
  };
})
  .then((data) => {
    data.forEach((r) => {
      r.age_group = ageGroup(r.age);
    });
    DATA.records = data;
    initializeDashboard();
  })
  .catch((err) => {
    console.error("Failed to load Esophageal_Dataset_Cleaned.csv:", err);
    const box = document.getElementById("dataError");
    box.style.display = "block";
    box.innerHTML =
      "Could not load <code>Esophageal_Dataset_Cleaned.csv</code>. " +
      "Most browsers block local file access for security reasons, so opening <code>index.html</code> " +
      "directly (double-click) will show a blank dashboard. Run a local server from this folder instead, e.g. " +
      "<code>python -m http.server</code>, then open <code>http://localhost:8000</code> &mdash; or use VS Code's " +
      '"Live Server" extension.';
  });
const COLORS = {
  primary: "#1C6E8C",
  primaryDark: "#0F4C5C",
  primaryPale: "#DCEBEF",
  risk: "#C1440E",
  riskPale: "#F5DDD1",
  good: "#4C956C",
  goodPale: "#DCEEE2",
  gold: "#B8860B",
  ink: "#152238",
  inkSoft: "#4A5A6B",
  categorical: [
    "#1C6E8C",
    "#C1440E",
    "#B8860B",
    "#4C956C",
    "#6C5B7B",
    "#8E9AAF",
  ],
};
const tooltip = d3.select("#tooltip");
function showTip(html, evt) {
  tooltip
    .style("display", "block")
    .html(html)
    .style("left", evt.clientX + 14 + "px")
    .style("top", evt.clientY + 10 + "px");
}
function hideTip() {
  tooltip.style("display", "none");
}

const state = {
  gender: "",
  stage: "",
  histology: "",
  age: "",
  country: "",
  search: "",
  stageDrill: "",
  stageSubstage: "",
  stageBand: "",
};

function applyFilters(records) {
  return records.filter((r) => {
    if (state.gender && r.gender !== state.gender) return false;
    if (
      state.stageBand === "early" &&
      !(r.stage === "Stage I" || r.stage === "Stage II")
    )
      return false;
    if (
      state.stageBand === "late" &&
      !(r.stage === "Stage III" || r.stage === "Stage IV")
    )
      return false;
    if (state.stageSubstage && r.stage_raw !== state.stageSubstage)
      return false;
    if (
      state.stageDrill &&
      !state.stageSubstage &&
      r.stage !== state.stageDrill
    )
      return false;
    if (
      !state.stageSubstage &&
      !state.stageDrill &&
      state.stage &&
      r.stage !== state.stage
    )
      return false;
    if (state.histology && r.histology !== state.histology) return false;
    if (state.age && r.age_group !== state.age) return false;
    if (state.country && r.country !== state.country) return false;
    if (
      state.search &&
      !r.id.toLowerCase().includes(state.search.toLowerCase())
    )
      return false;
    return true;
  });
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr))
    .filter((x) => x && x !== "Unknown")
    .sort();
}
function fillSelect(id, values, key) {
  const sel = d3.select(id);
  values.forEach((v) => {
    sel.append("option").attr("value", v).text(v);
  });
  sel.on("change", function () {
    state[key] = this.value;
    refreshAll();
  });
}
function initializeDashboard() {
  fillSelect(
    "#f-gender",
    uniqueSorted(DATA.records.map((r) => r.gender)),
    "gender",
  );

  const stageSelect = d3.select("#f-stage");
  stageSelect.append("option").attr("value", "").text("");
  ["Stage I", "Stage II", "Stage III", "Stage IV"].forEach((v) =>
    stageSelect.append("option").attr("value", v).text(v),
  );
  stageSelect.on("change", function () {
    state.stage = this.value;
    state.stageDrill = this.value || "";
    state.stageSubstage = "";
    refreshAll();
  });

  fillSelect(
    "#f-histology",
    uniqueSorted(DATA.records.map((r) => r.histology)),
    "histology",
  );

  fillSelect("#f-age", ["<50", "50-59", "60-69", "70-79", "80+"], "age");

  fillSelect(
    "#f-country",
    uniqueSorted(DATA.records.map((r) => r.country)),
    "country",
  );

  renderTimeline();
  refreshAll();

  d3.select("#stageDrillDown").on("click", () => {
    const top = state.stageDrill || state.stage;
    if (!top) return;
    state.stageDrill = top;
    const subs = Array.from(
      new Set(
        DATA.records
          .filter((r) => r.stage === state.stageDrill)
          .map((r) => r.stage_raw),
      ),
    ).filter((x) => x);
    state.stageSubstage = subs.length ? subs[0] : "";
    d3.select("#f-stage").property("value", state.stageDrill);
    refreshAll();
  });
  d3.select("#stageDrillUp").on("click", () => {
    if (state.stageSubstage) {
      state.stageSubstage = "";
    } else if (state.stageDrill) {
      state.stageDrill = "";
      state.stage = "";
      d3.select("#f-stage").property("value", "");
    }
    refreshAll();
  });
  d3.select("#stageDrillBack").on("click", () => {
    state.stage = "";
    state.stageDrill = "";
    state.stageSubstage = "";
    d3.select("#f-stage").property("value", "");
    refreshAll();
  });
}

d3.select("#patientSearch").on("input", function () {
  state.search = this.value;
  refreshAll();
});
d3.select("#resetBtn").on("click", () => {
  Object.keys(state).forEach((k) => (state[k] = ""));
  ["#f-gender", "#f-stage", "#f-histology", "#f-age", "#f-country"].forEach(
    (id) => d3.select(id).property("value", ""),
  );
  d3.select("#patientSearch").property("value", "");
  const defaultFontSize = 17;
  const elderFontSizeValue = document.getElementById("elderFontSizeValue");
  const elderFontSizeSlider = document.getElementById("elderFontSize");
  elderFontSizeSlider.value = defaultFontSize;
  document.documentElement.style.setProperty(
    "--elder-font-size",
    `${defaultFontSize}px`,
  );
  elderFontSizeValue.textContent = `${defaultFontSize}px`;
  elderFontSizeSlider.setAttribute("aria-valuenow", defaultFontSize);
  elderFontSizeSlider.setAttribute(
    "aria-valuetext",
    `${defaultFontSize} pixels`,
  );

  syncIconButtons();
  refreshAll();
});

d3.selectAll(".icon-btn[data-key]").on("click", function () {
  const key = this.getAttribute("data-key");
  const value = this.getAttribute("data-value");
  state[key] = state[key] === value ? "" : value;
  if (key === "gender") d3.select("#f-gender").property("value", state.gender);
  syncIconButtons();
  refreshAll();
});
d3.select("#iconResetBtn").on("click", () => {
  Object.keys(state).forEach((k) => (state[k] = ""));
  ["#f-gender", "#f-stage", "#f-histology", "#f-age", "#f-country"].forEach(
    (id) => d3.select(id).property("value", ""),
  );
  d3.select("#patientSearch").property("value", "");
  syncIconButtons();
  refreshAll();
});
function syncIconButtons() {
  d3.selectAll(".icon-btn[data-key]").classed("active", function () {
    const key = this.getAttribute("data-key");
    const value = this.getAttribute("data-value");
    return state[key] === value;
  });
  d3.select('.icon-btn[data-key="gender"][data-value=""]').classed(
    "active",
    !state.gender,
  );
  d3.select('.icon-btn[data-key="stageBand"][data-value=""]').classed(
    "active",
    !state.stageBand,
  );
}
syncIconButtons();

d3.select("#dataNotesToggle").on("click", function () {
  const body = document.getElementById("dataNotesBody");
  const open = body.style.display !== "none";
  body.style.display = open ? "none" : "block";
  this.textContent = open
    ? "ℹ  Data Cleaning & Assumptions"
    : "✕  Hide Data Notes";
});

function renderActiveChips() {
  const chips = Object.entries(state).filter(([k, v]) => v && k !== "search");
  const el = d3
    .select("#activeFilters")
    .selectAll(".chip")
    .data(chips, (d) => d[0]);
  el.exit().remove();
  const enter = el.enter().append("div").attr("class", "chip");
  enter
    .merge(el)
    .html((d) => `${d[1]} &times;`)
    .on("click", (evt, d) => {
      state[d[0]] = "";
      d3.select("#f-" + d[0]).property("value", "");
      refreshAll();
    });
}

const kpiDefs = [
  {
    key: "total_patients",
    label: "Total Patients",
    unit: "",
    color: COLORS.primary,
    fmt: d3.format(","),
  },
  {
    key: "mortality_rate",
    label: "Mortality Rate",
    unit: "%",
    color: COLORS.risk,
    fmt: d3.format(".1f"),
  },
  {
    key: "avg_age_dx",
    label: "Avg. Age at Diagnosis",
    unit: "yrs",
    color: COLORS.gold,
    fmt: d3.format(".1f"),
  },
  {
    key: "pct_stage_III_IV",
    label: "Stage III/IV Cases",
    unit: "%",
    color: COLORS.risk,
    fmt: d3.format(".1f"),
  },
  {
    key: "pct_adenocarcinoma",
    label: "Adenocarcinoma Share",
    unit: "%",
    color: COLORS.primary,
    fmt: d3.format(".1f"),
  },
];
// Kid mode: fewer cards, rounded numbers, positively-framed (alive % / caught-early % rather than
// mortality / late-stage), each with a big emoji so it reads without needing the clinical terms.
const kidKpiDefs = [
  {
    key: "total_patients",
    label: "Patients in this Study",
    unit: "",
    color: COLORS.primary,
    fmt: d3.format(","),
    icon: "assets/patients.png",
  },
  {
    key: "pct_alive",
    label: "Alive",
    unit: "%",
    color: COLORS.good,
    fmt: d3.format(".0f"),
    icon: "assets/alive.png",
  },
  {
    key: "pct_early",
    label: "Found out early",
    unit: "%",
    color: COLORS.primary,
    fmt: d3.format(".0f"),
    icon: "assets/time.png",
  },
];
function computeKPIs(recs) {
  const n = recs.length;
  const dead = recs.filter((r) => r.vital === "Dead").length;
  const ages = recs.map((r) => r.age).filter((x) => x != null);
  const stage34 = recs.filter(
    (r) => r.stage === "Stage III" || r.stage === "Stage IV",
  ).length;
  const stage12 = recs.filter(
    (r) => r.stage === "Stage I" || r.stage === "Stage II",
  ).length;
  const adeno = recs.filter((r) => r.histology === "Adenocarcinoma").length;
  return {
    total_patients: n,
    mortality_rate: n ? (dead / n) * 100 : 0,
    avg_age_dx: ages.length ? d3.mean(ages) : 0,
    pct_stage_III_IV: n ? (stage34 / n) * 100 : 0,
    pct_adenocarcinoma: n ? (adeno / n) * 100 : 0,
    pct_alive: n ? ((n - dead) / n) * 100 : 0,
    pct_early: n ? (stage12 / n) * 100 : 0,
  };
}
function renderKPIs(recs) {
  const vals = computeKPIs(recs);
  const isKid = document.body.classList.contains("mode-simplified");
  const isElder = document.body.classList.contains("mode-accessible");

  let defs = isKid ? kidKpiDefs : kpiDefs;
  if (isElder) defs = defs.filter((d) => d.key !== "pct_adenocarcinoma");

  const cards = d3
    .select("#kpiGrid")
    .selectAll(".kpi-card")
    .data(defs, (d) => d.key);
  cards.exit().remove();

  const enter = cards.enter().append("div").attr("class", "kpi-card");

  // 1. Append an <img> instead of <div>
  enter.append("img").attr("class", "kid-icon");
  enter.append("div").attr("class", "label");
  enter.append("div").attr("class", "value");

  const merged = enter.merge(cards);

  // 2. Set 'src' attribute and alt text dynamically
  merged
    .select(".kid-icon")
    .style("display", isKid ? "block" : "none")
    .attr("src", (d) => d.icon || "")
    .attr("alt", (d) => d.label);

  merged.select(".label").text((d) => d.label);
  merged
    .select(".value")
    .html((d) => d.fmt(vals[d.key]) + `<span class="unit">${d.unit}</span>`);
}

function barChart(svgSel, data, opts) {
  const {
    xKey,
    yKey,
    stateKey,
    color,
    height,
    angle,
    isStage,
    isSubstage,
    colorKey,
  } = opts || {};
  const svg = d3.select(svgSel);
  svg.selectAll("*").remove();
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width || 500;
  const H = height || 240;
  svg.attr("viewBox", `0 0 ${width} ${H}`);
  const margin = { top: 14, right: 16, bottom: angle ? 56 : 34, left: 44 };
  const w = width - margin.left - margin.right,
    h = H - margin.top - margin.bottom;
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleBand()
    .domain(data.map((d) => d[xKey]))
    .range([0, w])
    .padding(0.28);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[yKey]) * 1.15 || 1])
    .range([h, 0]);
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .selectAll("text")
    .attr("transform", angle ? "rotate(-30)" : null)
    .style("text-anchor", angle ? "end" : "middle");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4));
  if (!data || data.length === 0 || d3.max(data, (d) => d[yKey]) <= 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", H / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.inkSoft)
      .style("font-size", "12px")
      .text("No data available");
    return;
  }
  g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .classed(
      "dim",
      (d) => stateKey && state[stateKey] && state[stateKey] !== d[xKey],
    )
    .attr("x", (d) => x(d[xKey]))
    .attr("width", x.bandwidth())
    .attr("y", (d) => (d[yKey] === 0 ? h - 2 : y(d[yKey])))
    .attr("height", (d) => (d[yKey] === 0 ? 2 : h - y(d[yKey])))
    .classed("zero", (d) => d[yKey] === 0)
    .attr("fill", (d) => (colorKey && d[colorKey] ? d[colorKey] : color))
    .attr("rx", 3)
    .on("mousemove", (evt, d) =>
      showTip(`<b>${d[xKey]}</b><br>${d[yKey].toLocaleString()} cases`, evt),
    )
    .on("mouseleave", hideTip)
    .on("click", (evt, d) => {
      if (!stateKey) return;
      if (isStage) {
        if (isSubstage) {
          state.stageSubstage = state.stageSubstage === d[xKey] ? "" : d[xKey];
          d3.select("#f-stage").property("value", state.stageDrill);
        } else if (d[xKey] === "Unknown") {
          state.stage = state.stage === d[xKey] ? "" : d[xKey];
          state.stageDrill = "";
          state.stageSubstage = "";
          d3.select("#f-stage").property("value", "");
        } else {
          state.stage = d[xKey];
          state.stageDrill = d[xKey];
          state.stageSubstage = "";
          d3.select("#f-stage").property("value", state.stageDrill);
        }
      } else {
        state[stateKey] = state[stateKey] === d[xKey] ? "" : d[xKey];
        d3.select("#f-" + stateKey).property("value", state[stateKey]);
        state.stageDrill = "";
        state.stageSubstage = "";
      }
      refreshAll();
    });
  if (document.body.classList.contains("mode-accessible")) {
    g.selectAll(".bar-value-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "bar-value-label")
      .attr("x", (d) => x(d[xKey]) + x.bandwidth() / 2)
      .attr("y", (d) => (d[yKey] === 0 ? h - 2 : y(d[yKey])) - 6)
      .attr("text-anchor", "middle")
      .text((d) => d[yKey].toLocaleString());
  }
}
// Map country names to UN Numeric Codes (used by standard TopoJSON world-atlas)
const COUNTRY_ISO_MAP = {
  "United States": "840",
  Vietnam: "704",
  Brazil: "076",
  Canada: "124",
  Netherlands: "528",
  Russia: "643",
  Ukraine: "804",
  Bulgaria: "100",
  Australia: "036",
  "United Kingdom": "826",
};

let cachedWorldData = null;

function renderChoroplethMap(recs) {
  const svg = d3.select("#chartChoropleth");
  svg.selectAll("*").remove();

  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width || 800;
  const H = 380;
  svg.attr("viewBox", `0 0 ${width} ${H}`);

  const countsByIso = d3.rollup(
    recs.filter((r) => r.country && r.country !== "Not Reported"),
    (v) => v.length,
    (d) => COUNTRY_ISO_MAP[d.country],
  );

  const projection = d3
    .geoNaturalEarth1()
    .scale(width / 6.5)
    .translate([width / 2, H / 1.75]);

  const path = d3.geoPath().projection(projection);

  const maxCount = d3.max(Array.from(countsByIso.values())) || 1787;
  const colorScale = d3
    .scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolateYlOrRd);

  function drawMap(worldData) {
    const g = svg.append("g").attr("class", "map-layer");
    const zoom = d3
      .zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);
    const countries = topojson.feature(
      worldData,
      worldData.objects.countries,
    ).features;

    g.selectAll("path")
      .data(countries)
      .enter()
      .append("path")
      .attr("class", "choropleth-country")
      .attr("d", path)
      .attr("fill", (d) => {
        const id = String(d.id).padStart(3, "0");
        const count = countsByIso.get(id);
        return count ? colorScale(count) : "#e2e8f0";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.6)
      .style("cursor", (d) => {
        const id = String(d.id).padStart(3, "0");
        return countsByIso.has(id) ? "pointer" : "default";
      })
      .classed("dim", (d) => {
        if (!state.country) return false;
        const id = String(d.id).padStart(3, "0");
        return COUNTRY_ISO_MAP[state.country] !== id;
      })
      .on("mousemove", (evt, d) => {
        const id = String(d.id).padStart(3, "0");
        const countryName =
          Object.keys(COUNTRY_ISO_MAP).find((k) => COUNTRY_ISO_MAP[k] === id) ||
          d.properties.name ||
          "Other Region";
        const count = countsByIso.get(id) || 0;
        showTip(
          `<b>${countryName}</b><br>${count.toLocaleString()} cases`,
          evt,
        );
      })
      .on("mouseleave", hideTip)
      .on("click", (evt, d) => {
        const id = String(d.id).padStart(3, "0");
        const matchedCountry = Object.keys(COUNTRY_ISO_MAP).find(
          (k) => COUNTRY_ISO_MAP[k] === id,
        );
        if (matchedCountry) {
          state.country =
            state.country === matchedCountry ? "" : matchedCountry;
          d3.select("#f-country").property("value", state.country);
          refreshAll();
        }
      });
    const legendW = 160,
      legendH = 10;
    const legendG = svg
      .append("g")
      .attr("transform", `translate(20, ${H - 35})`);

    const defs = svg.append("defs");
    const linearGradient = defs
      .append("linearGradient")
      .attr("id", "choropleth-gradient");

    linearGradient
      .selectAll("stop")
      .data(d3.range(0, 1.1, 0.2))
      .enter()
      .append("stop")
      .attr("offset", (d) => `${d * 100}%`)
      .attr("stop-color", (d) => colorScale(d * maxCount));

    legendG
      .append("rect")
      .attr("width", legendW)
      .attr("height", legendH)
      .style("fill", "url(#choropleth-gradient)")
      .attr("rx", 2);

    const legendScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([0, legendW]);
    const legendAxis = d3.axisBottom(legendScale).ticks(3).tickSize(3);

    legendG
      .append("g")
      .attr("transform", `translate(0, ${legendH})`)
      .call(legendAxis)
      .selectAll("text")
      .style("font-size", "9px")
      .style("fill", COLORS.inkSoft);
  }

  if (cachedWorldData) {
    drawMap(cachedWorldData);
  } else {
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((worldData) => {
        cachedWorldData = worldData;
        drawMap(worldData);
      })
      .catch((err) => {
        console.error("Error loading world map GeoJSON:", err);
      });
  }
}

function donutChart(svgSel, data, opts) {
  const { labelKey, valueKey, stateKey, height } = opts;
  const svg = d3.select(svgSel);
  svg.selectAll("*").remove();
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width || 300;
  const H = height || 240;
  svg.attr("viewBox", `0 0 ${width} ${H}`);
  const radius = Math.min(width * 0.42, H * 0.42);
  const g = svg
    .append("g")
    .attr("transform", `translate(${width * 0.32},${H / 2})`);
  const color = d3
    .scaleOrdinal()
    .domain(data.map((d) => d[labelKey]))
    .range(COLORS.categorical);
  const pie = d3
    .pie()
    .value((d) => d[valueKey])
    .sort(null);
  const arc = d3
    .arc()
    .innerRadius(radius * 0.55)
    .outerRadius(radius);
  const total = d3.sum(data, (d) => d[valueKey]);
  g.selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data[labelKey]))
    .attr("class", "bar")
    .classed(
      "dim",
      (d) =>
        stateKey && state[stateKey] && state[stateKey] !== d.data[labelKey],
    )
    .on("mousemove", (evt, d) =>
      showTip(
        `<b>${d.data[labelKey]}</b><br>${d.data[valueKey].toLocaleString()} (${((d.data[valueKey] / total) * 100).toFixed(1)}%)`,
        evt,
      ),
    )
    .on("mouseleave", hideTip)
    .on("click", (evt, d) => {
      if (!stateKey) return;
      state[stateKey] =
        state[stateKey] === d.data[labelKey] ? "" : d.data[labelKey];
      d3.select("#f-" + stateKey).property("value", state[stateKey]);
      refreshAll();
    });
  if (document.body.classList.contains("mode-accessible")) {
    g.selectAll(".donut-value-label")
      .data(pie(data))
      .enter()
      .append("text")
      .attr("class", "donut-value-label")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .text((d) => ((d.data[valueKey] / total) * 100).toFixed(0) + "%");
  }
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.1em")
    .style("font-family", "Fraunces,serif")
    .style("font-weight", 600)
    .style("font-size", "20px")
    .text(total.toLocaleString());
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "1.3em")
    .style("font-size", "10px")
    .style("fill", COLORS.inkSoft)
    .text("cases");
  const isElderChart = document.body.classList.contains("mode-accessible");
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width * 0.62},${H / 2 - data.length * 11})`,
    );
  const rows = legend
    .selectAll("g")
    .data(data)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0,${i * 22})`);
  rows
    .append("rect")
    .attr("width", 11)
    .attr("height", 11)
    .attr("rx", 2)
    .attr("fill", (d) => color(d[labelKey]));
  rows
    .append("text")
    .attr("x", 16)
    .attr("y", 9.5)
    .style("font-size", isElderChart ? "13px" : "11px")
    .style("fill", COLORS.ink)
    .text((d) =>
      d[labelKey].length > 20 ? d[labelKey].slice(0, 19) + "…" : d[labelKey],
    );
}

function countBy(recs, key, order) {
  const m = d3.rollup(
    recs,
    (v) => v.length,
    (d) => d[key],
  );
  const keys = order || Array.from(m.keys());
  return keys.map((k) => ({ key: k, count: m.get(k) || 0 }));
}

function riskMultiples(recs) {
  const factorsMeta = [
    { field: "smoker", title: "Smoking History" },
    { field: "alcohol", title: "Alcohol Use" },
    { field: "reflux", title: "Reflux History" },
    { field: "barretts", title: "Barrett's Esophagus" },
    { field: "hpylori", title: "H. pylori Infection" },
  ];
  const container = d3.select("#chartRisk");
  container.html("");
  const available = factorsMeta.filter((fm) =>
    recs.some((r) => r[fm.field] && r[fm.field] !== "Unknown"),
  );
  if (available.length === 0) {
    container
      .append("div")
      .style("height", "100%")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("color", COLORS.inkSoft)
      .style("font-size", "13px")
      .text("Risk factor charts are unavailable for this dataset.");
    return;
  }
  available.forEach((fm) => {
    const groups = d3.rollup(
      recs.filter((r) => r[fm.field] && r[fm.field] !== "Unknown"),
      (v) => ({
        n: v.length,
        dead: v.filter((r) => r.vital === "Dead").length,
      }),
      (d) => d[fm.field],
    );
    const data = Array.from(groups, ([k, v]) => ({
      cat: k,
      n: v.n,
      pct: v.n ? (v.dead / v.n) * 100 : 0,
    })).filter((d) => d.n >= 8);
    const card = container
      .append("div")
      .attr("class", "risk-card")
      .style("width", "100%");
    card.append("div").attr("class", "card-title").text(fm.title);
    if (data.length === 0) {
      card
        .append("div")
        .style("font-size", "12px")
        .style("color", COLORS.inkSoft)
        .style("text-align", "center")
        .text("Not enough data");
      return;
    }
    const vbW = 450,
      vbH = 220,
      margin = { l: 20, r: 10, t: 10, b: 42 };
    const svg = card
      .append("svg")
      .attr("viewBox", `0 0 ${vbW} ${vbH}`)
      .attr("width", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet");
    const w = vbW - margin.l - margin.r,
      h = vbH - margin.t - margin.b;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.l},${margin.t})`);
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.cat))
      .range([0, w])
      .padding(0.35);
    const y = d3
      .scaleLinear()
      .domain([0, Math.max(60, d3.max(data, (d) => d.pct) || 0)])
      .range([h, 0]);
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "9px")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end")
      .attr("fill", COLORS.inkSoft);
    g.append("g")
      .call(d3.axisLeft(y).ticks(3))
      .selectAll("text")
      .style("font-size", "9px");
    g.selectAll("path,line").attr("stroke", "#E3E8E7");
    const rMax = d3.max(data, (d) => d.n) || 1;
    const r = d3.scaleSqrt().domain([0, rMax]).range([3, 12]);
    g.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.cat) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.pct))
      .attr("r", (d) => r(d.n))
      .attr("fill", COLORS.risk)
      .attr("fill-opacity", 0.85)
      .attr("stroke", COLORS.risk)
      .on("mousemove", (evt, d) =>
        showTip(
          `<b>${fm.title}: ${d.cat}</b><br>Mortality: ${d.pct.toFixed(1)}%<br>n = ${d.n}`,
          evt,
        ),
      )
      .on("mouseleave", hideTip);
  });
}

function lineChart(svgSel, data, opts) {
  const { xKey, yKey, height, color, yFmt } = opts;
  const svg = d3.select(svgSel);
  svg.selectAll("*").remove();
  const bbox = svg.node().getBoundingClientRect();
  const width = bbox.width || 500,
    H = height || 230;
  svg.attr("viewBox", `0 0 ${width} ${H}`);
  if (!data || data.length === 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", H / 2)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.inkSoft)
      .style("font-size", "12px")
      .text("No data available");
    return;
  }
  const margin = { top: 14, right: 20, bottom: 32, left: 44 };
  const w = width - margin.left - margin.right,
    h = H - margin.top - margin.bottom;
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scalePoint()
    .domain(data.map((d) => d[xKey]))
    .range([0, w])
    .padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, (d3.max(data, (d) => d[yKey]) || 1) * 1.2])
    .range([h, 0]);
  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y).ticks(4));
  const line = d3
    .line()
    .x((d) => x(d[xKey]))
    .y((d) => y(d[yKey]))
    .curve(d3.curveMonotoneX);
  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 2.5)
    .attr("d", line);
  g.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d[xKey]))
    .attr("cy", (d) => y(d[yKey]))
    .attr("r", 4.5)
    .attr("fill", color)
    .on("mousemove", (evt, d) =>
      showTip(`<b>${d[xKey]}</b><br>${yFmt ? yFmt(d[yKey]) : d[yKey]}`, evt),
    )
    .on("mouseleave", hideTip);
}

function renderParcoords(recs) {
  const container = d3.select("#chartParcoords");
  container.selectAll("*").remove();
  if (document.getElementById("chartParcoords")) {
    Plotly.purge("chartParcoords");
  }

  const hasValidFields = recs.some(
    (r) => r.age != null || r.pack_years != null || r.lymph_examined != null,
  );
  if (!hasValidFields) {
    container
      .append("div")
      .style("height", "100%")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("color", COLORS.inkSoft)
      .style("font-size", "13px")
      .text("Parallel coordinates data is not available.");
    return;
  }

  const sample = recs;
  const dimensions = [
    {
      label: "Age at Diagnosis",
      values: sample.map((r) => r.age ?? 0),
    },
    {
      label: "Smoking Pack-Years",
      values: sample.map((r) => r.pack_years ?? 0),
    },
    {
      label: "Positive Lymph Nodes Examined",
      values: sample.map((r) => r.lymph_examined ?? 0),
    },
  ];

  const vitalColor = sample.map((r) => (r.vital === "Dead" ? 1 : 0));

  Plotly.newPlot(
    "chartParcoords",
    [
      {
        type: "parcoords",
        line: {
          color: vitalColor,
          colorscale: [
            [0, "#4C956C"],
            [1, "#C1440E"],
          ],
          showscale: true,
          colorbar: {
            title: "Vital",
            tickvals: [0, 1],
            ticktext: ["Alive", "Dead"],
            len: 0.6,
          },
        },
        dimensions: dimensions,
      },
    ],
    {
      margin: { t: 36, l: 60, r: 40, b: 10 },
      font: { family: "Poppins, sans-serif", size: 11, color: "#4A5A6B" },
      paper_bgcolor: "transparent",
    },
    { displayModeBar: false, responsive: true },
  );
}
function renderTrellis(recs) {
  const container = d3.select("#chartTrellis");
  container.selectAll("*").remove();
  const collection = recs.filter(
    (r) => r.pack_years != null && r.lymph_examined != null,
  );
  if (collection.length === 0) {
    container
      .append("div")
      .style("height", "100%")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("color", COLORS.inkSoft)
      .style("font-size", "13px")
      .text("Trellis plot not available for this dataset.");
    return;
  }
  const stages = ["Stage I", "Stage II", "Stage III", "Stage IV"];
  const allPack = d3.max(collection, (d) => d.pack_years) || 1;
  const allLymph = d3.max(collection, (d) => d.lymph_examined) || 1;
  const stageData = stages.map((stage) => ({
    stage,
    values: collection.filter((r) => r.stage === stage),
  }));
  const panel = container;
  stageData.forEach((dataset) => {
    const card = panel.append("div").attr("class", "trellis-card");
    const svg = card
      .append("svg")
      .attr("viewBox", "0 0 260 150")
      .attr("preserveAspectRatio", "xMidYMid meet");
    const width = 260,
      height = 150,
      margin = { top: 24, right: 14, bottom: 30, left: 48 };
    const w = width - margin.left - margin.right,
      h = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, allPack]).nice().range([0, w]);
    const y = d3.scaleLinear().domain([0, allLymph]).nice().range([h, 0]);
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(4));
    g.append("g").call(d3.axisLeft(y).ticks(4));
    g.append("text")
      .attr("x", 0)
      .attr("y", -8)
      .attr("fill", COLORS.ink)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .text(dataset.stage);
    g.selectAll("circle")
      .data(dataset.values)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.pack_years))
      .attr("cy", (d) => y(d.lymph_examined))
      .attr("r", 4)
      .attr("fill", (d) => (d.vital === "Dead" ? COLORS.risk : COLORS.good))
      .attr("fill-opacity", 0.75)
      .on("mousemove", (evt, d) =>
        showTip(
          `<b>${d.id}</b><br>Age: ${d.age ?? "—"}<br>Pack-years: ${d.pack_years}<br>Lymph nodes+: ${d.lymph_examined}<br>Vital: ${d.vital}`,
          evt,
        ),
      )
      .on("mouseleave", hideTip);
    g.append("text")
      .attr("x", w)
      .attr("y", h + 24)
      .attr("text-anchor", "end")
      .attr("fill", COLORS.inkSoft)
      .style("font-size", "10px")
      .text("Pack-years");
    g.append("text")
      .attr("x", -38)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90,-38,${h / 2})`)
      .attr("fill", COLORS.inkSoft)
      .style("font-size", "10px")
      .text("Lymph nodes+");
  });
}

function renderInsights(recs) {
  const stage34 = recs.filter(
    (r) => r.stage === "Stage III" || r.stage === "Stage IV",
  );
  const stage34MortRate = stage34.length
    ? (stage34.filter((r) => r.vital === "Dead").length / stage34.length) * 100
    : 0;
  const early = recs.filter(
    (r) => r.stage === "Stage I" || r.stage === "Stage II",
  );
  const earlyMortRate = early.length
    ? (early.filter((r) => r.vital === "Dead").length / early.length) * 100
    : 0;
  const topCountry = Array.from(
    d3.rollup(
      recs,
      (v) => v.length,
      (d) => d.country,
    ),
  ).sort((a, b) => b[1] - a[1])[0];
  const insights = [
    {
      cls: "risk",
      title: "High-Risk Patient Group",
      stat: `${stage34MortRate.toFixed(0)}%`,
      text: `Patients diagnosed at Stage III/IV show a mortality rate of ${stage34MortRate.toFixed(1)}%, versus ${earlyMortRate.toFixed(1)}% for Stage I/II. Late-stage detection is the single strongest driver of mortality in this cohort — supporting investment in earlier screening pathways.`,
    },
    {
      cls: "",
      title: "Regional Case Concentration",
      stat: topCountry ? topCountry[0] : "—",
      text: `${topCountry ? topCountry[0] : "—"} accounts for the largest share of procured cases (${topCountry ? topCountry[1].toLocaleString() : "—"} patients). Concentration in specific tissue-source regions can guide where specialist oncology resources and trial recruitment are prioritized.`,
    },
    {
      cls: "good",
      title: "Pathology Yield Indicator",
      stat: `${(d3.mean(recs.map((r) => r.lymph_examined).filter((x) => x != null)) || 0).toFixed(1)}`,
      text: `Average number of positive lymph node findings per patient is derived from the available pathology data in this dataset. It can help indicate disease spread where staging is already recorded.`,
    },
  ];
  const grid = d3
    .select("#insightGrid")
    .selectAll(".insight-card")
    .data(insights);
  const enter = grid
    .enter()
    .append("div")
    .attr("class", (d) => "insight-card " + d.cls);
  enter.append("h4");
  enter.append("div").attr("class", "stat");
  enter.append("p");
  const merged = enter.merge(grid);
  merged.attr("class", (d) => "insight-card " + d.cls);
  merged.select("h4").text((d) => d.title);
  merged.select(".stat").text((d) => d.stat);
  merged.select("p").text((d) => d.text);
}

// Plain-language stand-in for the Clinical Summaries (parallel coords / trellis) and
// Risk Factors (scatter grid) sections, which are hidden in Elderly mode since they require
// fine motor hovering and small multi-panel reading.
function renderElderSummary(recs) {
  if (!document.body.classList.contains("mode-accessible")) return;
  const stage34 = recs.filter(
    (r) => r.stage === "Stage III" || r.stage === "Stage IV",
  );
  const stage12 = recs.filter(
    (r) => r.stage === "Stage I" || r.stage === "Stage II",
  );
  const rate34 = stage34.length
    ? (stage34.filter((r) => r.vital === "Dead").length / stage34.length) * 100
    : 0;
  const rate12 = stage12.length
    ? (stage12.filter((r) => r.vital === "Dead").length / stage12.length) * 100
    : 0;
  const heavySmokers = recs.filter(
    (r) => r.pack_years != null && r.pack_years >= 40,
  );
  const heavyRate = heavySmokers.length
    ? (heavySmokers.filter((r) => r.vital === "Dead").length /
        heavySmokers.length) *
      100
    : 0;
  const avgLymphLate =
    d3.mean(stage34.map((r) => r.lymph_examined).filter((x) => x != null)) || 0;
  const avgLymphEarly =
    d3.mean(stage12.map((r) => r.lymph_examined).filter((x) => x != null)) || 0;
  const text = `Among the patients currently shown: those diagnosed at Stage III or IV had a mortality rate of about ${rate34.toFixed(0)}%, compared to about ${rate12.toFixed(0)}% for Stage I or II. Heavier smokers (40+ pack-years) had a mortality rate of about ${heavyRate.toFixed(0)}%. On average, later-stage patients also had more positive lymph nodes found (about ${avgLymphLate.toFixed(1)} vs ${avgLymphEarly.toFixed(1)} for early-stage), which points to more advanced disease spread at diagnosis. In short: earlier detection and lower smoking exposure are both linked to better outcomes in this data.`;
  d3.select("#elderSummaryText").text(text);
}

function renderTable(recs) {
  const title = state.stageSubstage
    ? `Patients — ${state.stageSubstage}`
    : state.stageDrill
      ? `Patients — ${state.stageDrill}`
      : state.stage
        ? `Patients — ${state.stage}`
        : state.histology
          ? `Patients — ${state.histology}`
          : "All Patients";
  document.getElementById("drillTitle").textContent = title;
  document.getElementById("rowCount").textContent =
    recs.length.toLocaleString();
  const rows = recs.slice(0, 300);
  const tb = d3.select("#tableBody");
  const tr = tb.selectAll("tr").data(rows, (d) => d.id);
  tr.exit().remove();
  const enter = tr.enter().append("tr");
  enter.append("td").attr("class", "id");
  enter.append("td").attr("class", "gender");
  enter.append("td").attr("class", "age");
  enter.append("td").attr("class", "stage");
  enter.append("td").attr("class", "histology");
  enter.append("td").attr("class", "vital");
  const merged = enter.merge(tr);
  merged.select(".id").text((d) => d.id);
  merged.select(".gender").text((d) => d.gender);
  merged.select(".age").text((d) => d.age ?? "—");
  merged
    .select(".stage")
    .text((d) => (state.stageDrill && d.stage_raw ? d.stage_raw : d.stage));
  merged
    .select(".histology")
    .text((d) =>
      d.histology === "Squamous Cell Carcinoma"
        ? "SCC"
        : d.histology === "Adenocarcinoma"
          ? "Adeno"
          : d.histology,
    );
  merged
    .select(".vital")
    .html(
      (d) =>
        `<span class="tag ${d.vital === "Dead" ? "dead" : "alive"}">${d.vital}</span>`,
    );
}

const TIMELINE_PHASES = [
  {
    id: 1,
    title: "Phase 1: Project Initiation",
    start: "2026-02-16",
    end: "2026-02-27",
    className: "done",
    desc: "Defined clinical problem parameters for senior oncology management analytics.",
  },
  {
    id: 2,
    title: "Phase 2: Data Aggregation",
    start: "2026-02-28",
    end: "2026-03-20",
    className: "done",
    desc: "Extracted 3,985 multi-departmental registry rows from the TCGA-ESCA clinical data core.",
  },
  {
    id: 3,
    title: "Phase 3: Schema Cleaning",
    start: "2026-03-21",
    end: "2026-04-10",
    className: "done",
    desc: "Imputed missing values, handled lower-bound adjustments for 1,816 missing pack-years, and normalized stages.",
  },
  {
    id: 4,
    title: "Phase 4: Dashboard Architecture",
    start: "2026-04-11",
    end: "2026-06-10",
    className: "milestone",
    desc: "Built single-page reactive state engine linking cross-filters, parallel coordinates, and trellis scatter charts.",
  },
  {
    id: 5,
    title: "Phase 5: UX Accessibility Auditing",
    start: "2026-06-11",
    end: "2026-06-30",
    className: "upcoming",
    desc: "Validating layout reflow and ensuring baseline accessibility for Elderly and Child modes.",
  },
  {
    id: 6,
    title: "Phase 6: Deployment",
    start: "2026-07-01",
    end: "2026-07-15",
    className: "upcoming",
    desc: "Hosting final build for live corporate executive demonstration.",
  },
];
function renderTimeline() {
  const container = document.getElementById("timeline");

  if (!container) return;

  // Clear the old chart before drawing
  container.innerHTML = "";

  const parseDate = d3.timeParse("%Y-%m-%d");
  const formatDate = d3.timeFormat("%d %b %Y");

  // Convert the date strings into JavaScript Date objects
  const phases = TIMELINE_PHASES.map((phase) => ({
    ...phase,
    startDate: parseDate(phase.start),
    endDate: parseDate(phase.end),
  }));

  const margin = {
    top: 55,
    right: 30,
    bottom: 20,
    left: 230,
  };

  const rowHeight = 54;
  const chartWidth = Math.max(container.clientWidth, 900);
  const innerHeight = phases.length * rowHeight;
  const chartHeight = margin.top + innerHeight + margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "gantt-svg")
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

  // Find the earliest start date and latest end date
  const earliestDate = d3.min(phases, (d) => d.startDate);
  const latestDate = d3.max(phases, (d) => d.endDate);

  const xScale = d3
    .scaleTime()
    .domain([
      d3.timeDay.offset(earliestDate, -5),
      d3.timeDay.offset(latestDate, 5),
    ])
    .range([margin.left, chartWidth - margin.right]);

  // Draw alternating row backgrounds
  svg
    .selectAll(".gantt-row-background")
    .data(phases)
    .enter()
    .append("rect")
    .attr("class", (d, i) =>
      i % 2 === 0 ? "gantt-row-background" : "gantt-row-background alternate",
    )
    .attr("x", 0)
    .attr("y", (d, i) => margin.top + i * rowHeight)
    .attr("width", chartWidth)
    .attr("height", rowHeight);

  // Draw the date axis
  const xAxis = d3
    .axisTop(xScale)
    .ticks(d3.timeMonth.every(1))
    .tickFormat(d3.timeFormat("%b %Y"))
    .tickSize(-innerHeight);

  svg
    .append("g")
    .attr("class", "gantt-axis")
    .attr("transform", `translate(0, ${margin.top})`)
    .call(xAxis);

  // Draw row separator lines
  svg
    .selectAll(".gantt-row-line")
    .data(phases)
    .enter()
    .append("line")
    .attr("class", "gantt-row-line")
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", (d, i) => margin.top + (i + 1) * rowHeight)
    .attr("y2", (d, i) => margin.top + (i + 1) * rowHeight);

  // Draw phase names on the left
  svg
    .selectAll(".gantt-phase-label")
    .data(phases)
    .enter()
    .append("text")
    .attr("class", "gantt-phase-label")
    .attr("x", 15)
    .attr("y", (d, i) => margin.top + i * rowHeight + rowHeight / 2)
    .attr("dominant-baseline", "middle")
    .text((d) => d.title);

  // Draw the Gantt bars
  svg
    .selectAll(".gantt-bar")
    .data(phases)
    .enter()
    .append("rect")
    .attr("class", (d) => `gantt-bar ${d.className}`)
    .attr("x", (d) => xScale(d.startDate))
    .attr("y", (d, i) => margin.top + i * rowHeight + 10)
    .attr("width", (d) => {
      // Add one day so the end date is visually included
      const inclusiveEndDate = d3.timeDay.offset(d.endDate, 1);

      return Math.max(5, xScale(inclusiveEndDate) - xScale(d.startDate));
    })
    .attr("height", 34)
    .attr("rx", 6)
    .attr("ry", 6)
    .on("mouseenter", function (event, d) {
      showTip(
        `
      <b>${d.title}</b><br>
      Start date: ${formatDate(d.startDate)}<br>
      End date: ${formatDate(d.endDate)}<br><br>
      <b>Description</b><br>
      ${d.desc}
    `,
        event,
      );
    })
    .on("mousemove", function (event, d) {
      showTip(
        `
          <b>${d.title}</b><br>
          Start date: ${formatDate(d.startDate)}<br>
          End date: ${formatDate(d.endDate)}<br><br>
          <b>Description</b><br>
          ${d.desc}
        `,
        event,
      );
    })
    .on("mouseleave", function () {
      hideTip();
    });

  // Add short labels inside the bars
  svg
    .selectAll(".gantt-bar-label")
    .data(phases)
    .enter()
    .append("text")
    .attr("class", "gantt-bar-label")
    .attr("x", (d) => xScale(d.startDate) + 9)
    .attr("y", (d, i) => margin.top + i * rowHeight + 27)
    .attr("dominant-baseline", "middle")
    .text((d) => `Phase ${d.id}`);
}

function refreshAll() {
  const recs = applyFilters(DATA.records);
  renderActiveChips();
  renderKPIs(recs);
  renderChoroplethMap(recs);
  donutChart(
    "#chartHistology",
    countBy(recs, "histology").map((d) => ({ type: d.key, count: d.count })),
    { labelKey: "type", valueKey: "count", stateKey: "histology", height: 260 },
  );
  barChart(
    "#chartAge",
    countBy(recs, "age_group", ["<50", "50-59", "60-69", "70-79", "80+"]).map(
      (d) => ({ group: d.key, count: d.count }),
    ),
    {
      xKey: "group",
      yKey: "count",
      stateKey: "age",
      color: COLORS.gold,
      height: 220,
    },
  );
  donutChart(
    "#chartVital",
    countBy(recs, "vital").map((d) => ({ status: d.key, count: d.count })),
    { labelKey: "status", valueKey: "count", height: 220 },
  );
  const countryTop = countBy(recs, "country")
    .map((d) => ({ country: d.key, count: d.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
  barChart("#chartCountry", countryTop, {
    xKey: "country",
    yKey: "count",
    stateKey: "country",
    color: COLORS.primaryDark,
    height: 220,
    angle: true,
  });

  renderParcoords(recs);
  renderTrellis(recs);
  riskMultiples(recs);

  const stageOrder = ["Stage I", "Stage II", "Stage III", "Stage IV"];
  let stageData;
  const stageOpts = {
    xKey: "stage",
    yKey: "count",
    stateKey: state.stageDrill ? "stageSubstage" : "stage",
    color: COLORS.primary,
    height: 260,
    isStage: true,
    isSubstage: Boolean(state.stageDrill),
  };
  if (state.stageDrill) {
    const stageRecs = recs.filter((r) => r.stage === state.stageDrill);
    const topCount = stageRecs.length;
    const m = d3.rollup(
      stageRecs,
      (v) => v.length,
      (d) => (d.stage_raw || "").trim() || state.stageDrill,
    );
    const entries = Array.from(m, ([k, v]) => {
      const mm = String(k)
        .toUpperCase()
        .match(/^STAGE\s*(I{1,3}|IV)([A-Z]*)/i);
      const suffix = mm ? mm[2] || "" : "";
      return { key: k, count: v, suffix };
    }).filter((entry) => entry.suffix !== "");
    entries.sort((a, b) => {
      if (a.suffix === b.suffix) return a.key.localeCompare(b.key);
      return a.suffix.localeCompare(b.suffix);
    });
    stageData = entries.map((e) => ({ stage: e.key, count: e.count }));
  } else {
    stageData = countBy(recs, "stage", [
      "Stage I",
      "Stage II",
      "Stage III",
      "Stage IV",
      "Unknown",
    ]).map((d) => ({
      stage: d.key,
      count: d.count,
      barColor: d.key === "Unknown" ? "#B9C2C0" : COLORS.primary,
    }));
  }
  stageOpts.colorKey = "barColor";
  barChart("#chartStage", stageData, stageOpts);

  const resourceData = stageOrder.map((s) => {
    const sub = recs.filter((r) => r.stage === s && r.lymph_examined != null);
    return {
      stage: s,
      count: sub.length ? d3.mean(sub.map((r) => r.lymph_examined)) : 0,
    };
  });
  barChart("#chartResource", resourceData, {
    xKey: "stage",
    yKey: "count",
    color: COLORS.primaryDark,
    height: 230,
  });

  const btnDown = d3.select("#stageDrillDown");
  const btnUp = d3.select("#stageDrillUp");
  const btnBack = d3.select("#stageDrillBack");
  if (!state.stage && !state.stageDrill && !state.stageSubstage) {
    btnDown.style("display", "none");
    btnUp.style("display", "none");
    btnBack.style("display", "none");
  } else if (state.stage && !state.stageDrill) {
    btnDown.style("display", "inline-block");
    btnUp.style("display", "none");
    btnBack.style("display", "inline-block");
  } else if (state.stageDrill && !state.stageSubstage) {
    btnDown.style("display", "none");
    btnUp.style("display", "inline-block");
    btnBack.style("display", "inline-block");
  } else if (state.stageSubstage) {
    btnDown.style("display", "none");
    btnUp.style("display", "inline-block");
    btnBack.style("display", "inline-block");
  }

  renderInsights(recs);
  renderElderSummary(recs);
  renderTable(recs);
}

d3.selectAll("#viewToggle button").on("click", function () {
  const mode = this.getAttribute("data-mode");
  d3.selectAll("#viewToggle button").classed("active", false);
  d3.select(this).classed("active", true);
  document.body.className = "mode-" + mode;
  setTimeout(() => {
    if (DATA.records.length) refreshAll();
  }, 60);
});

// Elderly font slider
const elderFontSizeSlider = document.getElementById("elderFontSize");
const elderFontSizeValue = document.getElementById("elderFontSizeValue");

/* While dragging, only update the number beside the slider */
elderFontSizeSlider.addEventListener("input", function () {
  elderFontSizeValue.textContent = `${this.value}px`;
});

/* Apply the font size only after the slider is released */
elderFontSizeSlider.addEventListener("change", function () {
  const size = Number(this.value);

  document.documentElement.style.setProperty("--elder-font-size", `${size}px`);

  elderFontSizeValue.textContent = `${size}px`;

  this.setAttribute("aria-valuenow", size);
  this.setAttribute("aria-valuetext", `${size} pixels`);

  /*
   Wait for the new layout to finish before redrawing charts.
   This prevents repeated chart resizing while dragging.
  */
  requestAnimationFrame(() => {
    if (DATA.records.length) {
      refreshAll();
    }
  });
});

/* Set the initial value without redrawing the dashboard */
document.documentElement.style.setProperty(
  "--elder-font-size",
  `${elderFontSizeSlider.value}px`,
);

elderFontSizeValue.textContent = `${elderFontSizeSlider.value}px`;

window.addEventListener("resize", () => {
  if (DATA.records.length) refreshAll();
});
