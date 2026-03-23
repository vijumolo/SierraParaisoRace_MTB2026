import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, 'public');
const dataDir = path.join(publicDir, 'data');
const pdfDir = path.join(publicDir, 'pdfs');

const sourceDir =
  'C:/Users/VICTOR MOSSO/Desktop/ForMe/Material TCT/eventos/Cronometradas TCT2026/Eventos Curit\u00ed (corolnel Alvarez)/Resultados/MTB';
const resultsPdfPath = path.join(sourceDir, 'RESULTADOS POR CATEGORIAS MTB.pdf');
const diplomasPdfPath = path.join(sourceDir, 'DIPLOMAS MTB.pdf');

const eventMeta = {
  eventName: 'SIERRA PARAISO RACE',
  modality: 'MTB',
  location: 'Curiti, Santander',
  eventDate: '2026-03-22',
  distanceLabel: '23 y 50 km',
};

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const getPageLines = async (pdfPath) => {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const text = await page.getTextContent();
    const rows = new Map();

    for (const item of text.items) {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: Math.round(item.transform[4]), text: item.str });
    }

    const lines = [...rows.entries()]
      .sort((left, right) => right[0] - left[0])
      .map(([y, items]) => ({
        y,
        items: items.sort((left, right) => left.x - right.x),
        text: items
          .sort((left, right) => left.x - right.x)
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      }))
      .filter((line) => line.text);

    pages.push({ pageNumber, lines });
  }

  return pages;
};

const cleanDuplicateHalves = (value) => {
  const words = value.trim().split(/\s+/);
  if (words.length % 2 !== 0) return value.trim();
  const half = words.length / 2;
  const left = words.slice(0, half).join(' ');
  const right = words.slice(half).join(' ');
  return normalize(left) === normalize(right) ? left : value.trim();
};

const parseDiplomas = async () => {
  const pages = await getPageLines(diplomasPdfPath);
  const records = [];

  for (const page of pages) {
    const usefulLines = page.lines
      .map((line) => cleanDuplicateHalves(line.text))
      .filter((line) => line && !line.startsWith('Este diploma emitido') && !line.startsWith('CURIT'));

    const name = usefulLines.find((line) => !line.includes('CERTIFICA') && !line.includes('DORSAL') && !line.includes('POSICION') && !line.includes('TIEMPO') && !line.includes('CATEGORIA') && !line.includes('MTB') && !/^\d/.test(line));
    const bibMatch = usefulLines.find((line) => line.startsWith('DORSAL No.'));
    const categoryIndex = usefulLines.findIndex((line) => line === 'DE LA CATEGORIA');
    const category = categoryIndex >= 0 ? usefulLines[categoryIndex + 1] : '';
    const positionIndex = usefulLines.findIndex((line) => line === 'POSICION CATEGORIA POSICION GENERAL GLOBAL');
    const categoryPositionLine = positionIndex >= 0 ? usefulLines[positionIndex + 1] : '';
    const globalPositionLine = positionIndex >= 0 ? usefulLines[positionIndex + 2] : '';
    const timeIndex = usefulLines.findIndex((line) => line === 'TIEMPO PISTOLA TIEMPO CHIP');
    const timeLine = timeIndex >= 0 ? usefulLines[timeIndex + 1] : '';

    const bib = bibMatch?.match(/(\d+)/)?.[1] ?? '';
    const [gunTime = '', chipTime = ''] = timeLine.split(/\s+/);
    const categoryPosition = categoryPositionLine.match(/^(\d+\.)/)?.[1] ?? '';
    const categoryTotal = categoryPositionLine.match(/\/(\d+)/)?.[1] ?? '';
    const globalPosition = globalPositionLine.match(/^(\d+\.)/)?.[1] ?? '';
    const globalTotal = globalPositionLine.match(/\/(\d+)/)?.[1] ?? '';

    if (!bib || !name || !category) {
      continue;
    }

    records.push({
      bib,
      name,
      category,
      categoryPosition,
      categoryTotal,
      globalPosition,
      globalTotal,
      gunTime,
      chipTime,
      diplomaPage: page.pageNumber,
    });
  }

  return records;
};

const parseResults = async (diplomaRecords) => {
  const pages = await getPageLines(resultsPdfPath);
  const diplomaMap = new Map(diplomaRecords.map((record) => [record.bib, record]));
  const results = [];

  let currentCategory = '';
  let currentGender = '';

  for (const page of pages) {
    for (let index = 0; index < page.lines.length; index += 1) {
      const row = page.lines[index];
      const line = row.text;

      if (
        line.startsWith('SIERRA PARAISO RACE') ||
        line.startsWith('XCM-RUNNING') ||
        line.startsWith('GENERAL X') ||
        line.startsWith('CURIT') ||
        line.startsWith('Puesto ') ||
        /^[1-5]$/.test(line)
      ) {
        continue;
      }

      if (line === 'Hombres' || line === 'Damas') {
        currentGender = line;
        continue;
      }

      const hasRowMarker = row.items.some((item) => /^\d+\.$/.test(item.text.trim()));
      if (!hasRowMarker) {
        currentCategory = line;
        continue;
      }

      const position = row.items.find((item) => /^\d+\.$/.test(item.text.trim()))?.text.trim() ?? '';
      const bib = row.items.find((item) => /^\d+$/.test(item.text.trim()) && item.x >= 55 && item.x <= 95)?.text.trim() ?? '';
      const nameCity = row.items
        .filter((item) => item.x >= 110 && item.x < 360)
        .map((item) => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const diff = row.items.find((item) => /^(--|\+\d+:\d{2}(?::\d{2})?)$/.test(item.text.trim()))?.text.trim() ?? '';
      const averageSpeed = row.items.find((item) => /Km\/h$/.test(item.text.trim()))?.text.trim() ?? '';

      let chipTime = row.items.find((item) => /^\d{2}:\d{2}:\d{2}$/.test(item.text.trim()))?.text.trim() ?? '';
      if (!chipTime) {
        const nextRow = page.lines[index + 1];
        const nextTime = nextRow?.items.find((item) => /^\d{2}:\d{2}:\d{2}$/.test(item.text.trim()) && item.x >= 390 && item.x <= 450)?.text.trim() ?? '';
        if (nextTime && Math.abs((nextRow?.y ?? 0) - row.y) <= 2) {
          chipTime = nextTime;
          index += 1;
        }
      }

      if (!position || !bib || !nameCity || !chipTime || !diff || !averageSpeed) {
        continue;
      }

      const diploma = diplomaMap.get(bib);
      const name = diploma?.name ?? nameCity;
      let city = '';

      if (diploma) {
        const normalizedCombined = normalize(nameCity);
        const normalizedName = normalize(diploma.name);
        if (normalizedCombined.startsWith(normalizedName)) {
          city = nameCity.slice(diploma.name.length).trim();
        } else {
          const escapedName = diploma.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          city = nameCity.replace(new RegExp(`^${escapedName}\\s*`, 'i'), '').trim();
        }
      }

      results.push({
        bib,
        position,
        category: diploma?.category ?? currentCategory,
        gender: currentGender,
        name,
        city,
        chipTime,
        diff,
        averageSpeed,
      });
    }
  }

  return results;
};

const main = async () => {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  const diplomas = await parseDiplomas();
  const results = await parseResults(diplomas);

  const merged = results
    .map((result) => {
      const diploma = diplomas.find((record) => record.bib === result.bib);
      return {
        ...result,
        plate: result.bib,
        gunTime: diploma?.gunTime ?? '',
        chipTimeDiploma: diploma?.chipTime ?? '',
        categoryPosition: diploma?.categoryPosition ?? result.position,
        categoryTotal: diploma?.categoryTotal ?? '',
        globalPosition: diploma?.globalPosition ?? '',
        globalTotal: diploma?.globalTotal ?? '',
        diplomaPage: diploma?.diplomaPage ?? null,
        diplomaUrl: diploma ? `/pdfs/diplomas-mtb.pdf#page=${diploma.diplomaPage}` : null,
      };
    })
    .sort((left, right) => Number(left.globalPosition.replace('.', '')) - Number(right.globalPosition.replace('.', '')));

  const payload = {
    event: eventMeta,
    sourceFiles: {
      resultsPdf: '/pdfs/resultados-por-categorias-mtb.pdf',
      diplomasPdf: '/pdfs/diplomas-mtb.pdf',
    },
    totals: {
      participants: merged.length,
      categories: [...new Set(merged.map((item) => item.category))].length,
      cities: [...new Set(merged.map((item) => item.city).filter(Boolean))].length,
    },
    categories: [...new Set(merged.map((item) => item.category))].sort((left, right) => left.localeCompare(right, 'es')),
    cities: [...new Set(merged.map((item) => item.city).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es')),
    results: merged,
  };

  fs.copyFileSync(resultsPdfPath, path.join(pdfDir, 'resultados-por-categorias-mtb.pdf'));
  fs.copyFileSync(diplomasPdfPath, path.join(pdfDir, 'diplomas-mtb.pdf'));
  fs.writeFileSync(path.join(dataDir, 'sierra-paraiso-race-mtb.json'), JSON.stringify(payload, null, 2));

  console.log(`Participantes: ${payload.totals.participants}`);
  console.log(`Categorias: ${payload.totals.categories}`);
  console.log(`Ciudades: ${payload.totals.cities}`);
};

await main();
