const TEST_POINTS = [
  {id:"P01",northing:2724504,easting:225420,z:1854},
  {id:"P02",northing:2724656,easting:224026,z:1827},
  {id:"P03",northing:2724647,easting:223360,z:1813},
  {id:"P04",northing:2724661,easting:222642,z:1797},
  {id:"P05",northing:2724970,easting:221622,z:1781},
  {id:"P06",northing:2725405,easting:221651,z:1784},
  {id:"P07",northing:2725958,easting:221636,z:1780},
  {id:"P08",northing:2726504,easting:222149,z:1796},
  {id:"P09",northing:2726516,easting:223428,z:1823},
  {id:"P10",northing:2726488,easting:225047,z:1858},
  {id:"P11",northing:2726414,easting:225521,z:1868},
  {id:"P12",northing:2726414,easting:225772,z:1873},
  {id:"P13",northing:2724909,easting:226070,z:1871},
  {id:"P14",northing:2726238,easting:225814,z:1874},
  {id:"P15",northing:2725629,easting:226845,z:1892}
];

const TRANINV_URL = "https://www.inegi.org.mx/app/geo2/traninv/api/utm";
const TRANITRF_URL = "https://www.inegi.org.mx/app/geo2/tranitrf/recibe.do";
const TRANITRF_DOWNLOAD_URL = "https://www.inegi.org.mx/app/geo2/tranitrf/download.do?file=";
const sourceRows = document.querySelector("#sourceRows");
const resultRows = document.querySelector("#resultRows");
const transformButton = document.querySelector("#transform");
const processing = document.querySelector("#processing");
const fields = ["sourceFrame","targetFrame","zone","hemisphere","zType"];
const frameNames = {nad27:"NAD27",itrf92:"ITRF92, época 1988.0",itrf2008:"ITRF2008, época 2010.0"};
let busy = false;

const format = value => value == null || !Number.isFinite(value) ? "" : Number(value).toLocaleString("es-MX",{maximumFractionDigits:10});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function configuration() {
  return Object.fromEntries(fields.map(id => {
    const key = {sourceFrame:"source_frame",targetFrame:"target_frame",zone:"zone",hemisphere:"hemisphere",zType:"z_type"}[id];
    const element = document.querySelector("#" + id);
    return [key,id === "zone" && element.value ? Number(element.value) : element.value];
  }));
}

function routeFor(config) {
  if (config.source_frame === config.target_frame) return [];
  if ((config.source_frame === "nad27" && config.target_frame === "itrf92") ||
      (config.source_frame === "itrf92" && config.target_frame === "nad27")) return ["TRANINV"];
  if (config.source_frame === "nad27" && config.target_frame === "itrf2008") return ["TRANINV","TRANITRF"];
  if (config.source_frame === "itrf2008" && config.target_frame === "nad27") return ["TRANITRF","TRANINV"];
  return ["TRANITRF"];
}

function utmToGeographic(easting,northing,zone,south = false) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const b = a * (1 - f);
  const eSquared = (a * a - b * b) / (a * a);
  const epSquared = eSquared / (1 - eSquared);
  const x = easting - 500000;
  const y = south ? northing - 10000000 : northing;
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const M = y / k0;
  const mu = M / (a * (1 - eSquared / 4 - 3 * eSquared * eSquared / 64 - 5 * eSquared ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - eSquared)) / (1 + Math.sqrt(1 - eSquared));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const sinPhi = Math.sin(phi1), cosPhi = Math.cos(phi1), tanPhi = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - eSquared * sinPhi * sinPhi);
  const T1 = tanPhi * tanPhi;
  const C1 = epSquared * cosPhi * cosPhi;
  const R1 = a * (1 - eSquared) / (1 - eSquared * sinPhi * sinPhi) ** 1.5;
  const D = x / (N1 * k0);
  const latitude = phi1 - N1 * tanPhi / R1 * (
    D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * epSquared) * D ** 4 / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * epSquared - 3 * C1 * C1) * D ** 6 / 720);
  const longitude = longOrigin * Math.PI / 180 + (
    D - (1 + 2 * T1 + C1) * D ** 3 / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * epSquared + 24 * T1 * T1) * D ** 5 / 120) / cosPhi;
  return {latitude:latitude * 180 / Math.PI,longitude:longitude * 180 / Math.PI};
}

function geographicToUtm(latitude,longitude,zone,south = false) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  const a = 6378137;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const eSquared = (a * a - b * b) / (a * a);
  const epSquared = eSquared / (1 - eSquared);
  const k0 = 0.9996;
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const lonDiff = lon - longOrigin * Math.PI / 180;
  const N = a / Math.sqrt(1 - eSquared * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = epSquared * Math.cos(lat) ** 2;
  const A = Math.cos(lat) * lonDiff;
  const M = a * ((1 - eSquared / 4 - 3 * eSquared ** 2 / 64 - 5 * eSquared ** 3 / 256) * lat -
    (3 * eSquared / 8 + 3 * eSquared ** 2 / 32 + 45 * eSquared ** 3 / 1024) * Math.sin(2 * lat) +
    (15 * eSquared ** 2 / 256 + 45 * eSquared ** 3 / 1024) * Math.sin(4 * lat) -
    35 * eSquared ** 3 / 3072 * Math.sin(6 * lat));
  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 +
    (5 - 18 * T + T * T + 72 * C - 58 * epSquared) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(lat) * (
    A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 +
    (61 - 58 * T + T * T + 600 * C - 330 * epSquared) * A ** 6 / 720));
  return {easting,northing:south ? northing + 10000000 : northing};
}

function decimalToDms(value) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return {degrees,minutes,seconds};
}

function formatDms(value,fractionDigits = 5) {
  const d = decimalToDms(value);
  return `${d.degrees},${String(d.minutes).padStart(2,"0")},${d.seconds.toFixed(fractionDigits)}`;
}

function renderPoints() {
  sourceRows.innerHTML = TEST_POINTS.map(p => `<tr><td>${p.id}</td><td>${format(p.easting)}</td><td>${format(p.northing)}</td><td>${format(p.z)}</td></tr>`).join("");
}

function updateInterface() {
  const config = configuration();
  transformButton.disabled = busy || fields.some(id => !document.querySelector("#" + id).value);
  if (config.source_frame && config.target_frame) {
    const route = routeFor(config);
    document.querySelector("#route").textContent = config.source_frame === config.target_frame ?
      `${frameNames[config.source_frame]} → ${frameNames[config.target_frame]}: no requiere transformación.` :
      `${frameNames[config.source_frame]} → ${frameNames[config.target_frame]} · Ruta: ${route.join(" → ")}`;
  } else document.querySelector("#route").textContent = "Complete la configuración para calcular la ruta.";
}

async function fetchWithTimeout(url,options,timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url,{...options,signal:controller.signal}); }
  finally { clearTimeout(timer); }
}

async function callTraninv(point,config,attempt = 0) {
  const datum = config.source_frame === "itrf92" ? "itrf92" : "nad27";
  const body = {datum,zona:config.zone,x:point.easting,y:point.northing};
  try {
    const response = await fetchWithTimeout(TRANINV_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error(`Respuesta no JSON de TRANINV (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(`TRANINV respondió HTTP ${response.status}: ${text.slice(0,300)}`);
    return {request:body,response:data};
  } catch (error) {
    if (attempt === 0 && error.name !== "AbortError") {
      await sleep(500);
      return callTraninv(point,config,attempt + 1);
    }
    throw error;
  }
}

async function callTranitrf(sourceFrame,geographicPoints) {
  const is92 = sourceFrame === "itrf92";
  const deA = is92 ? "de92a00" : "de00a92";
  const header = is92 ? "* ITRF 1992 época 1988.0" : "* ITRF 2008 época 2010.0";
  const lines = geographicPoints.map(p => {
    const lat = decimalToDms(p.latitude), lon = decimalToDms(p.longitude);
    const latHemisphere = p.latitude >= 0 ? "N" : "S";
    const lonHemisphere = p.longitude >= 0 ? "E" : "O";
    return `${p.id},${lat.degrees},${String(lat.minutes).padStart(2,"0")},${lat.seconds.toFixed(5)},${latHemisphere},${lon.degrees},${String(lon.minutes).padStart(2,"0")},${lon.seconds.toFixed(5)},${lonHemisphere},${p.height.toFixed(4)}`;
  });
  const form = new FormData();
  form.append("todo","upload");
  form.append("de_a",deA);
  form.append("select",is92 ? "1" : "2");
  form.append("tyfile",new File([header + "\r\n" + lines.join("\r\n") + "\r\n"],"transformacion.txt",{type:"text/plain"}));
  const inputText = header + "\r\n" + lines.join("\r\n") + "\r\n";

  const response = await fetchWithTimeout(TRANITRF_URL,{method:"POST",body:form});
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText); } catch (_) { throw new Error(`Respuesta no JSON de TRANITRF (HTTP ${response.status}).`); }
  if (!response.ok || !Array.isArray(result.errores) || result.errores.length) {
    throw new Error(`TRANITRF rechaza el archivo: ${(result.errores || []).join("; ") || responseText.slice(0,300)}`);
  }
  if (!result.archivo) throw new Error("TRANITRF no devolvió el nombre del archivo ZIP.");

  const zipResponse = await fetchWithTimeout(TRANITRF_DOWNLOAD_URL + encodeURIComponent(result.archivo));
  if (!zipResponse.ok) throw new Error(`Descarga TRANITRF HTTP ${zipResponse.status}.`);
  const zipBlob = await zipResponse.blob();
  return {request:{de_a:deA,select:is92 ? "1" : "2",input_text:inputText},response:result,zip:{size:zipBlob.size,type:zipBlob.type},zipBlob};
}

async function unzipFiles(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const files = {};
  for (let i = 0;i < bytes.length - 3;i++) {
    if (bytes[i] !== 80 || bytes[i + 1] !== 75 || bytes[i + 2] !== 1 || bytes[i + 3] !== 2) continue;
    const method = view.getUint16(i + 10,true);
    const compressedSize = view.getUint32(i + 20,true);
    const nameLength = view.getUint16(i + 28,true);
    const extraLength = view.getUint16(i + 30,true);
    const commentLength = view.getUint16(i + 32,true);
    const localOffset = view.getUint32(i + 42,true);
    const name = new TextDecoder("latin1").decode(bytes.slice(i + 46,i + 46 + nameLength));
    const start = localOffset + 30 + view.getUint16(localOffset + 26,true) + view.getUint16(localOffset + 28,true);
    let output;
    if (method === 0) output = bytes.slice(start,start + compressedSize);
    else if (method === 8) {
      const stream = new DecompressionStream("deflate-raw");
      const writer = stream.writable.getWriter();
      writer.write(bytes.slice(start,start + compressedSize));
      writer.close();
      output = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    } else throw new Error(`Método ZIP ${method} no compatible.`);
    files[name.split("/").pop()] = new TextDecoder("utf-8").decode(output);
  }
  return files;
}

function parseTranitrfCalculations(text) {
  const output = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/PLH\s+([^\s]+)\s+([NS])\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([EW])\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.-]+)/i);
    if (!match) continue;
    const latitude = Number(match[3]) + Number(match[4]) / 60 + Number(match[5]) / 3600;
    const longitude = Number(match[7]) + Number(match[8]) / 60 + Number(match[9]) / 3600;
    output[match[1]] = {
      latitude:match[2].toUpperCase() === "S" ? -latitude : latitude,
      longitude:match[6].toUpperCase() === "W" ? -longitude : longitude,
      height:Number(match[10])
    };
  }
  return output;
}

function traninvUtm(data) {
  const rows = Array.isArray(data) ? data : [data];
  const row = rows.find(item => item.proy === "utm");
  if (!row?.itrf92 || !row?.nad27) throw new Error("Respuesta TRANINV inesperada: no contiene ITRF92/NAD27 UTM.");
  return row;
}

async function transform() {
  if (busy) return;
  busy = true;
  processing.hidden = false;
  updateInterface();
  const config = configuration();
  const route = routeFor(config);
  const report = {started_at:new Date().toISOString(),configuration:config,route,points:[]};
  const messages = [];
  try {
    if (!config.source_frame || !config.target_frame || !config.zone || !config.hemisphere || !config.z_type) throw new Error("Complete todos los campos obligatorios.");
    if (config.z_type !== "ellipsoidal" && route.length) messages.push("Z se conserva como dato original porque su tipo no está confirmado como altura elipsoidal.");
    if (config.source_frame === config.target_frame) {
      report.points = TEST_POINTS.map(p => ({id:p.id,status:"sin_transformacion",source:{easting:p.easting,northing:p.northing,z:p.z},target:{easting:p.easting,northing:p.northing},warning:"Z original conservada; no fue transformada."}));
      messages.push("Los marcos son iguales; no se consultó INEGI.");
      renderResults(config,report.points, messages);
      return;
    }
    if (route.includes("TRANITRF") && config.z_type !== "ellipsoidal") throw new Error("TRANITRF requiere altura elipsoidal. Seleccione esa opción o conserve una altura no confirmada sin ejecutar la transformación.");

    if (route.length === 1 && route[0] === "TRANINV") {
      for (const point of TEST_POINTS) {
        const exchange = await callTraninv({easting:point.easting,northing:point.northing},config);
        const utm = traninvUtm(exchange.response);
        const target = config.target_frame === "itrf92" ? utm.itrf92 : utm.nad27;
        report.points.push({id:point.id,status:"transformado",source:{easting:point.easting,northing:point.northing,z:point.z},target:{easting:target.x,northing:target.y},inegi:exchange});
        await sleep(50);
      }
      messages.push("TRANINV: 15 respuestas individuales obtenidas secuencialmente.");
    } else {
      let working = [];
      report.points = TEST_POINTS.map(p => ({
        id:p.id,status:"procesando",source:{easting:p.easting,northing:p.northing,z:p.z}
      }));
      if (config.source_frame === "nad27" && config.target_frame === "itrf2008") {
        for (let index = 0; index < TEST_POINTS.length; index++) {
          const point = TEST_POINTS[index];
          const exchange = await callTraninv({easting:point.easting,northing:point.northing},config);
          const utm = traninvUtm(exchange.response);
          const frame = config.source_frame === "nad27" ? utm.itrf92 : utm.nad27;
          working.push({id:point.id,height:point.z,point:frame});
          report.points[index] = {
            ...report.points[index],
            inegi_traninv:exchange,
            status:"procesando"
          };
          await sleep(50);
        }
        messages.push("TRANINV: salida intermedia NAD27/ITRF92 obtenida secuencialmente.");
      } else {
        working = TEST_POINTS.map(p => ({id:p.id,height:p.z,point:{x:p.easting,y:p.northing}}));
      }

      const sourceFrameForItrf = config.source_frame === "nad27" || config.source_frame === "itrf92" ? "itrf92" : config.source_frame;
      const geographic = working.map(p => {
        if (sourceFrameForItrf === "itrf92") {
          const coord = utmToGeographic(p.point.x,p.point.y,config.zone,config.hemisphere === "S");
          return {id:p.id,latitude:coord.latitude,longitude:coord.longitude,height:p.height};
        }
        const coord = utmToGeographic(p.point.x,p.point.y,config.zone,config.hemisphere === "S");
        return {id:p.id,latitude:coord.latitude,longitude:coord.longitude,height:p.height};
      });
      const trf = await callTranitrf(sourceFrameForItrf,geographic);
      const files = await unzipFiles(trf.zipBlob);
      if (!files["CALCULOS.txt"]) throw new Error("El ZIP de TRANITRF no contiene CALCULOS.txt.");
      const parsed = parseTranitrfCalculations(files["CALCULOS.txt"]);
      trf.calculos = files["CALCULOS.txt"];
      trf.variacion = files["VARIACION.txt"] || null;

      for (const point of TEST_POINTS) {
        const result = parsed[point.id];
        if (!result) throw new Error(`TRANITRF no devolvió el punto ${point.id} en CALCULOS.txt.`);
        const utm = geographicToUtm(result.latitude,result.longitude,config.zone,config.hemisphere === "S");
        let target = {easting:utm.easting,northing:utm.northing};
        let finalExchange = null;
        if (config.target_frame === "nad27") {
          finalExchange = await callTraninv({easting:utm.easting,northing:utm.northing}, {source_frame:"itrf92",zone:config.zone});
          target = traninvUtm(finalExchange.response).nad27;
          target = {easting:target.x,northing:target.y};
        }
        const original = report.points.find(p => p.id === point.id) || {id:point.id};
        report.points[report.points.findIndex(p => p.id === point.id)] = {
          id:point.id,status:"transformado",source:{easting:point.easting,northing:point.northing,z:point.z},
          target,target_height:result.height,inegi_tranitrf:trf,inegi_traninv:finalExchange || original.inegi_traninv,
          warning:"Altura elipsoidal transformada únicamente si CALCULOS.txt la devuelve."
        };
      }
      messages.push("TRANITRF: lote procesado y ZIP descargado.");
    }
    renderResults(config,report.points,messages);
  } catch (error) {
    const text = error.name === "AbortError" ? "Una solicitud excedió el tiempo máximo de 30 segundos." : error.message;
    messages.push(text);
    renderResults(config,report.points,messages);
  } finally {
    report.finished_at = new Date().toISOString();
    showMessages(messages);
    showReport(report);
    busy = false;
    processing.hidden = true;
    updateInterface();
  }
}

function renderResults(config,points,messages) {
  const byId = new Map(points.map(p => [p.id,p]));
  resultRows.innerHTML = TEST_POINTS.map(source => {
    const point = byId.get(source.id) || {status:"bloqueado",warning:messages.join(" ")};
    return `<tr><td>${source.id}</td><td>${format(source.easting)}</td><td>${format(source.northing)}</td><td>${format(source.z)}</td>
      <td>${format(point.target?.easting)}</td><td>${format(point.target?.northing)}</td><td>${format(point.target_height)}</td>
      <td>${point.status || ""}</td><td class="${point.status === "bloqueado" ? "error" : ""}">${point.warning || ""}</td></tr>`;
  }).join("");
}

function showMessages(messages) {
  document.querySelector("#messageList").textContent = messages.join("\n") || "Sin mensajes.";
}

function showReport(report) {
  const count = report.points.reduce((sum,p) => sum + (p.inegi_traninv || p.inegi_tranitrf ? 1 : 0),0);
  document.querySelector("#reportSummary").textContent = `${report.points.length} puntos • ${count} trazas registradas de INEGI`;
  document.querySelector("#reportJson").textContent = JSON.stringify(report,null,2);
  document.querySelector("#reportDetails").hidden = false;
}

renderPoints();
fields.forEach(id => document.querySelector("#" + id).addEventListener("change",updateInterface));
transformButton.addEventListener("click",transform);
updateInterface();
