import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const width = window.innerWidth * 0.6;
const height = window.innerHeight * 0.7;


const svg = d3.select("#map")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g");

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("id", "tooltip")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("padding", "6px")
  .style("border", "1px solid #ccc")
  .style("display", "none");

let selectedDisease = 'pm25';

Promise.all([
  d3.json("data/world.geojson"),
  d3.csv("data/pm25_final_aggregated.csv", d => ({
    location: d.Location,
    year: +d.Period,
    pm25: +d.PM25
  })),
  d3.csv("data/cause_specific_death_rate_by_country.csv", d => ({
    location: d.Location,
    year: +d.Period,
    acute: +d.acute_lower_respiratoryinfections_per100k,
    copd: +d.chronic_obstructive_pulmonary_disease_per100k,
    heart: +d.ischaemic_heart_disease_per100k,
    stroke: +d.stroke_per100k,
    lung: +d.trachea_bronchus_lung_cancers_per100k
  }))
]).then(([geoData, pm25Data, lungData]) => {
  const years = Array.from(new Set(pm25Data.map(d => d.year))).sort();
  let currentYear = years[0];

  const projection = d3.geoNaturalEarth1()
    .scale(300)
    .translate([width / 2, height / 2]);

  const deathRateMap = {};
  lungData.forEach(d => {
    if (!deathRateMap[d.year]) deathRateMap[d.year] = {};
    deathRateMap[d.year][d.location] = {
      acute: d.acute,
      copd: d.copd,
      heart: d.heart,
      stroke: d.stroke,
      lung: d.lung
    };
  });

  const path = d3.geoPath().projection(projection);

  const colorScale = d3.scaleSequential(d3.interpolateReds);

  const yearToCountryMap = {};
  years.forEach(y => {
    yearToCountryMap[y] = {};
  });
  pm25Data.forEach(d => {
    yearToCountryMap[d.year][d.location] = d.pm25;
  });

  const countries = g.selectAll("path")
    .data(geoData.features)
    .enter().append("path")
    .attr("d", path)
    .attr("stroke", "#fff")
    .attr("fill", d => getColor(d.properties.name))
    .on("mouseover", function (event, d) {
      const country = d.properties.name;
      const pm25 = yearToCountryMap[currentYear][country];
      const rates = deathRateMap[currentYear]?.[country];

      d3.select(this)
        .raise()
        //.attr("stroke-width", 1)
        //.attr("stroke", "#000")
        .attr("fill", d => {
        const original = getColor(country);
        return d3.color(original).darker(0.8);
        });

      if (pm25 || rates) {
        tooltip
          .style("display", "block")
          .html(`
            <strong>${country}</strong><br>
            PM2.5: ${pm25?.toFixed(2) ?? "N/A"} µg/m³<br><br>
            <u>Cause-Specific Death Rate (/100k):</u><br>
            Acute Infections: ${rates?.acute?.toFixed(2) ?? "N/A"}<br>
            COPD: ${rates?.copd?.toFixed(2) ?? "N/A"}<br>
            Heart Disease: ${rates?.heart?.toFixed(2) ?? "N/A"}<br>
            Stroke: ${rates?.stroke?.toFixed(2) ?? "N/A"}<br>
            Lung Cancer: ${rates?.lung?.toFixed(2) ?? "N/A"}
          `)
          .style("left", event.pageX + 15 + "px")
          .style("top", event.pageY - 28 + "px");
      }
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("stroke", "#fff")
          .attr("fill", d => getColor(d.properties.name));
      
        tooltip.style("display", "none");
      })
      

  svg.call(d3.zoom().on("zoom", (event) => {
    g.attr("transform", event.transform);
  }));

  const legendWidth = 200;
  const legendHeight = 10;
  const defs = svg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "legend-gradient");

function drawLegend() {
    const legendHeight = 200;
    const legendWidth = 16;
    const legendX = width - 50;
    const legendY = 50;
  
    const legendDomain = colorScale.domain();
    const minVal = legendDomain[0];
    const maxVal = legendDomain[1];
  
    const legendScale = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([legendHeight, 0]);
  
    linearGradient
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");
  
    linearGradient.selectAll("stop").remove();
    linearGradient.selectAll("stop")
      .data(d3.range(0, 1.01, 0.01))
      .enter().append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d =>
        colorScale(minVal + d * (maxVal - minVal))
      );
  
    svg.selectAll("#legendRect").remove();
    svg.append("rect")
      .attr("id", "legendRect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)")
      .style("stroke", "#ccc")
      .style("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4);
  
    const ticks = legendScale.ticks(6);
    svg.selectAll(".legend-tick").remove();
    svg.selectAll(".legend-tick")
      .data(ticks)
      .enter()
      .append("text")
      .attr("class", "legend-tick")
      .attr("x", legendX - 8)
      .attr("y", d => legendY + legendScale(d))
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .style("font-size", "12px")
      .text(d => Math.round(d));
  
    svg.selectAll("#legendLabel").remove();
    svg.append("text")
      .attr("id", "legendLabel")
      .attr("x", legendX + legendWidth / 2)
      .attr("y", legendY - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .text(
        selectedDisease === 'pm25'
          ? "PM2.5 (µg/m³)"
          : `${selectedDisease.toUpperCase()} (/100k)`
      );
  }
  
  

  function updateColorScale() {
    if (selectedDisease === 'pm25') {
      colorScale.domain([5, d3.max(pm25Data, d => d.pm25)]);
    } else {
      const values = [];
      for (const year in deathRateMap) {
        for (const country in deathRateMap[year]) {
          const val = deathRateMap[year][country][selectedDisease];
          if (!isNaN(val)) values.push(val);
        }
      }
      colorScale.domain([0, d3.max(values)]);
    }
  }

  function getColor(country) {
    if (selectedDisease === 'pm25') {
      const value = yearToCountryMap[currentYear][country];
      return value ? colorScale(value) : "#ccc";
    } else {
      const value = deathRateMap[currentYear]?.[country]?.[selectedDisease];
      return value ? colorScale(value) : "#ccc";
    }
  }

  function updateMap() {
    updateColorScale();
    countries.transition()
      .duration(300)
      .attr("fill", d => getColor(d.properties.name));
  
    drawLegend();
    const tooltipEl = document.getElementById("tooltip");
    if (tooltipEl.style.display === "block") {
        const countryPath = d3.select("path:hover").data()[0];
        const countryName = countryPath?.properties?.name;

        if (countryName) {
        const pm25 = yearToCountryMap[currentYear][countryName];
        const rates = deathRateMap[currentYear]?.[countryName];

        tooltip.html(`
            <strong>${countryName}</strong><br>
            PM2.5: ${pm25?.toFixed(2) ?? "N/A"} µg/m³<br><br>
            <u>Cause-Specific Death Rate (/100k):</u><br>
            Acute Infections: ${rates?.acute?.toFixed(2) ?? "N/A"}<br>
            COPD: ${rates?.copd?.toFixed(2) ?? "N/A"}<br>
            Heart Disease: ${rates?.heart?.toFixed(2) ?? "N/A"}<br>
            Stroke: ${rates?.stroke?.toFixed(2) ?? "N/A"}<br>
            Lung Cancer: ${rates?.lung?.toFixed(2) ?? "N/A"}
        `);
        }
    }
  }
  

  d3.select("#yearLabel").text(currentYear);
  d3.select("#title").text(`How Air Pollution Affects Health Over Time (${currentYear})`);

  const slider = d3.select("#yearSlider")
    .attr("min", d3.min(years))
    .attr("max", d3.max(years))
    .attr("step", 1)
    .attr("value", currentYear)
    .on("input", function () {
      currentYear = +this.value;
      d3.select("#yearLabel").text(currentYear);
      d3.select("#title").text(`How Air Pollution Affects Health Over Time (${currentYear})`);
      updateMap();
    });

  const select = d3.select("#diseaseSelect")
    .on("change", function () {
      selectedDisease = this.value;
      updateMap();
    });

  let isPlaying = false;
  let timer = null;

  const playBtn = d3.select("#playBtn");
  const playIcon = `<svg class="play-icon" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M8 5v14l11-7z"/>
  </svg>`;

  const pauseIcon = `<svg class="play-icon" viewBox="0 0 24 24" fill="white" width="16" height="16">
    <path d="M6 5h4v14H6zm8 0h4v14h-4z"/>
  </svg>`;

  playBtn.on("click", () => {
    if (!isPlaying) {
      isPlaying = true;
      playBtn.html(`${pauseIcon} Pause`);
      timer = setInterval(() => {
        currentYear++;
        if (currentYear > d3.max(years)) {
          currentYear = d3.min(years);
        }
        d3.select("#yearSlider").property("value", currentYear);
        d3.select("#yearLabel").text(currentYear);
        d3.select("#title").text(`How Air Pollution Affects Health Over Time (${currentYear})`);
        updateMap();
      }, 1000);
    } else {
      isPlaying = false;
      playBtn.html(`${playIcon} Play`);
      clearInterval(timer);
    }
  });

  updateMap();
});