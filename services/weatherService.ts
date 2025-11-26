import { TafEntry } from '../types';

// Extract gust from standard METAR string: 12345G67KT
export const extractGust = (text: string): number | null => {
  const match = text.match(/([0-9]{3}|VRB)([0-9]{2,3})G([0-9]{2,3})KT/);
  if (match && match[3]) {
    return parseInt(match[3], 10);
  }
  return null;
};

// Use a CORS proxy to fetch weather data
export const fetchProxyWeather = async (url: string): Promise<string> => {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('Proxy network response was not ok');
  const data = await res.json();
  return data.contents;
};

export const parseTaf = (rawHtml: string, code: string): TafEntry[] => {
  // 1. Clean HTML tags to get raw text
  let cleanText = rawHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // 2. Find the start of the TAF
  let tafStart = cleanText.indexOf(`TAF: ${code}`);
  if (tafStart === -1) tafStart = cleanText.indexOf(`TAF ${code}`);
  
  // Fallback: Look for standard groups
  if (tafStart === -1) {
     const firstGroup = cleanText.match(/(FM[0-9]{6}|BECMG [0-9]{4}\/[0-9]{4})/);
     if (firstGroup && firstGroup.index !== undefined) tafStart = firstGroup.index;
  }

  if (tafStart === -1) return [];

  // 3. Extract block
  let tafBlock = cleanText.substring(tafStart);
  const stopMarkers = [`METAR`, `OBSERVATION`, `Copyright`, `Key to Decoding`];
  let endIndex = tafBlock.length;
  stopMarkers.forEach(m => {
      const idx = tafBlock.indexOf(m, 10);
      if (idx > -1 && idx < endIndex) endIndex = idx;
  });
  tafBlock = tafBlock.substring(0, endIndex);

  // 4. Split
  const formattedTaf = tafBlock
      .replace(/(FM[0-9]{6})/g, '\n$1')
      .replace(/(BECMG [0-9]{4}\/[0-9]{4})/g, '\n$1')
      .replace(/(TEMPO [0-9]{4}\/[0-9]{4})/g, '\n$1')
      .replace(/(PROB[0-9]{2} [0-9]{4}\/[0-9]{4})/g, '\n$1');

  const lines = formattedTaf.split('\n').map(l => l.trim()).filter(l => l.length > 5);

  // 5. Map
  return lines.map((line, index) => {
      let type: TafEntry['type'] = 'BASE';
      let day: number | null = null;
      let hour: number | null = null;
      
      if (line.startsWith('FM')) {
          type = 'FM';
          day = parseInt(line.substring(2, 4), 10);
          hour = parseInt(line.substring(4, 6), 10);
      } else if (line.startsWith('TEMPO')) {
          type = 'TEMPO';
          day = parseInt(line.substring(6, 8), 10);
          hour = parseInt(line.substring(8, 10), 10);
      } else if (line.startsWith('BECMG')) {
          type = 'BECMG';
          day = parseInt(line.substring(6, 8), 10);
          hour = parseInt(line.substring(8, 10), 10);
      } else if (line.startsWith('TAF') || index === 0) {
          type = 'HEADER';
      }

      const gust = extractGust(line);

      return { 
          raw: line, 
          gust, 
          type,
          day,
          hour 
      };
  }); // Removed the filter that was hiding lines without gusts
};