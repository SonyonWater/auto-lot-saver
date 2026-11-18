(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['usedcars.ayvens.com'] = { extract };

  function extract() {
    const title = clean(document.querySelector('h1')?.textContent) || clean(document.title);
    const variant = findVariant(title);
    const rows = readSpecificationRows();
    const parsedTitle = splitTitle(title);
    const model = [parsedTitle.model, variant].filter(Boolean).join(' ');

    return {
      title: [parsedTitle.brand, model].filter(Boolean).join(' '),
      fields: {
        brand: parsedTitle.brand,
        model,
        year: rows['rok produkcji'] || '',
        mileage: rows.przebieg || '',
        color: rows.kolor || '',
        engine: [rows['pojemnosc silnika'], rows.moc, rows['moc km']].filter(Boolean).join(', '),
        transmission: rows['rodzaj skrzyni biegow'] || '',
        fuel: rows.paliwo || ''
      },
      details: {
        registrationDate: rows['data rejestracji'] || '',
        vin: rows['numer nadwozia'] || rows.vin || '',
        storageLocation: rows.lokalizacja || '',
        seats: rows.siedzenia || rows['liczba miejsc'] || ''
      },
      photos: collectPhotos(),
      photoApis: []
    };
  }

  function readSpecificationRows() {
    const rows = {};
    const labels = new Set([
      'rok produkcji', 'data rejestracji', 'paliwo', 'przebieg',
      'rodzaj skrzyni biegów', 'nadwozie', 'rodzaj napędu', 'kolor',
      'moc', 'pojemność silnika', 'numer nadwozia', 'moc km',
      'lokalizacja', 'siedzenia', 'liczba miejsc', 'vin'
    ].map(normalize));

    for (const element of document.querySelectorAll('dt, dd, tr, li, [class*="spec" i], [class*="detail" i], [class*="character" i]')) {
      const parts = directParts(element);
      if (parts.length < 2) continue;
      const label = normalize(parts[0]);
      if (labels.has(label) && !rows[label]) rows[label] = parts[1];
    }

    for (const element of document.querySelectorAll('dt, p, span, div')) {
      const label = normalize(element.textContent);
      if (!labels.has(label) || rows[label]) continue;
      const next = clean(element.nextElementSibling?.textContent);
      if (next && !labels.has(normalize(next))) rows[label] = next;
    }
    const lines = (document.body.innerText || '').split(/\n+/).map(clean).filter(Boolean);
    for (let index = 0; index < lines.length - 1; index += 1) {
      const label = normalize(lines[index]);
      const next = lines[index + 1];
      if (labels.has(label) && !rows[label] && next && !labels.has(normalize(next))) rows[label] = next;
    }
    return rows;
  }

  function collectPhotos() {
    const urls = [];
    for (const image of document.querySelectorAll('img[src], img[data-src], source[srcset]')) {
      const candidates = [image.currentSrc, image.getAttribute('src'), image.getAttribute('data-src'), image.getAttribute('data-lazy-src'), image.getAttribute('srcset')];
      for (const candidate of candidates) {
        if (!candidate) continue;
        for (const item of String(candidate).split(',')) {
          const source = item.trim().split(/\s+/)[0];
          if (!/usedcars\.ayvens\.com\/dw\/image\//i.test(source) || !/\/gallery\//i.test(source)) continue;
          try {
            const url = new URL(source, document.baseURI);
            url.search = '';
            urls.push(url.href);
          } catch { /* Ignore malformed lazy-image values. */ }
        }
      }
    }
    return [...new Set(urls)];
  }

  function directParts(element) {
    if (element.matches('tr')) return [...element.querySelectorAll('th, td')].map(child => clean(child.textContent)).filter(Boolean);
    const children = [...element.children];
    return children.length >= 2 ? children.map(child => clean(child.textContent)).filter(Boolean) : [];
  }

  function findVariant(title) {
    const heading = document.querySelector('h1');
    const candidates = [...(heading?.parentElement?.querySelectorAll('p, h2, h3, span') || [])]
      .map(element => clean(element.textContent))
      .filter(value => value && value !== title && !/dostępny|kup za|zł/i.test(value));
    return candidates[0] || '';
  }

  function splitTitle(title) {
    const words = clean(title).split(' ');
    return { brand: words.shift() || '', model: words.join(' ') };
  }
  function normalize(value) { return clean(value).replace(/[:]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
})();
