(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};
  window.AutoLotParsers['www.auto1.com'] = { extract };

  async function extract() {
    const table = readCarData();
    const title = carTitle();
    const [brand, ...model] = title.split(' ');
    const location = storageLocation();
    const condition = await conditionSchema();

    return {
      title,
      fields: {
        brand,
        model: model.join(' '),
        year: table['rok produkcji'] || '',
        mileage: table['odczyt przebiegu z licznika'] || '',
        color: table.kolor || '',
        engine: [table.pojemnosc, table.moc].filter(Boolean).join(', '),
        transmission: table['skrzynia biegow'] || '',
        fuel: table['rodzaj paliwa'] || ''
      },
      details: {
        registrationDate: table['pierwsza rejestracja'] || '',
        vin: table.vin || '',
        storageLocation: location,
        seats: table.siedzenia || ''
      },
      omitFields: ['vin', 'storageLocation'],
      photos: galleryPhotos(),
      extraFiles: condition ? [{ name: 'condition.svg', content: condition }] : [],
      photoApis: []
    };
  }

  function readCarData() {
    const values = {};
    for (const row of document.querySelectorAll('.car-data-table tr')) {
      const cells = [...row.querySelectorAll('td')].map(cell => clean(cell.textContent));
      if (cells.length >= 2 && cells[0] && cells[1]) values[normalize(cells[0])] = cells[1];
    }
    return values;
  }

  function carTitle() {
    const selectors = ['[data-qa-id="car-title"]', '.car-info-title h1', '.car-info-title', 'h1'];
    for (const selector of selectors) {
      const value = clean(document.querySelector(selector)?.textContent);
      if (value) return value;
    }
    return clean(document.title.replace(/\s*[-|]\s*AUTO1.*$/i, ''));
  }

  function galleryPhotos() {
    const gallery = document.querySelector('[data-testid="full-screen-gallery"], #main-car-gallery') || document;
    const displayed = [...gallery.querySelectorAll('img.image-gallery-image[src]')]
      .map(image => image.currentSrc || image.src);
    // AUTO1 keeps the URL of every original image in the thumbnail rail even
    // while it lazy-renders only a few full-size carousel slides.
    const fromThumbnails = [...gallery.querySelectorAll('img[src*="/pa/sr-x2-"]')]
      .map(image => (image.currentSrc || image.src).replace('/pa/sr-x2-', '/pa/max-'));
    return uniqueUrls([...displayed, ...fromThumbnails]
      .filter(url => /^https:\/\/img-[a-z-]+\.auto1\.com\//i.test(url) && /\/pa\/max-/i.test(url)));
  }

  function storageLocation() {
    const label = [...document.querySelectorAll('h1, h2, h3, h4, p, span, div')]
      .find(element => element.children.length === 0 && normalize(element.textContent) === 'lokalizacja samochodu');
    if (!label) return '';
    const parent = label.parentElement;
    const values = [...parent?.querySelectorAll('p, span, div') || []]
      .filter(element => element.children.length === 0)
      .map(element => clean(element.textContent))
      .filter(value => value && normalize(value) !== 'lokalizacja samochodu');
    return values[0] || '';
  }

  // AUTO1 renders the vehicle-condition view as SVG. Inline computed colours
  // make the exported file independent of page CSS when opened locally.
  async function conditionSchema() {
    const source = await waitForConditionSchema();
    if (!source) return '';
    const clone = source.cloneNode(true);
    const sourceElements = [source, ...source.querySelectorAll('*')];
    const cloneElements = [clone, ...clone.querySelectorAll('*')];
    for (let index = 0; index < sourceElements.length; index += 1) {
      const style = getComputedStyle(sourceElements[index]);
      const target = cloneElements[index];
      for (const property of ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'opacity', 'display', 'visibility']) {
        const value = style.getPropertyValue(property);
        if (value) target.style.setProperty(property, value);
      }
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  async function waitForConditionSchema() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const widget = document.querySelector('[data-testid="vehicle-condition-widget"], #vehicle-condition-widget');
      const source = widget && [...widget.querySelectorAll('svg')].find(svg => {
        const viewBox = svg.getAttribute('viewBox')?.replace(/\s+/g, ' ').trim();
        return Boolean(
          svg.querySelector('[data-qa-id^="vehicle-condition-car-schema"]')
          || svg.matches('[class*="schema" i]')
          || viewBox === '0 0 408 257'
        );
      });
      if (source) return source;
      await pause(150);
    }
    return null;
  }

  function uniqueUrls(urls) {
    const unique = new Map();
    for (const value of urls) {
      try {
        const url = new URL(value);
        const key = `${url.origin}${url.pathname}`;
        if (!unique.has(key)) unique.set(key, value);
      } catch { if (!unique.has(value)) unique.set(value, value); }
    }
    return [...unique.values()];
  }

  function normalize(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[:]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
})();
