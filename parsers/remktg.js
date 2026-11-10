(() => {
  window.AutoLotParsers = window.AutoLotParsers || {};

  window.AutoLotParsers['remktg.arval.com'] = { extract };

  function extract() {
    const root = document.querySelector('app-main-characteristics-card') || document;
    const pageText = clean(document.body.innerText);
    const brand = detail(root, 'Brand') || detail(document, 'Brand');
    const title = clean(document.querySelector('#submenu-main-characteristics, app-main-characteristics-card h2, app-header-details h1, app-header-details-info h1, h1')?.textContent || document.title);
    const registrationDate = first(pageText, /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\b/i);
    const year = registrationDate ? `20${registrationDate.slice(-2)}` : '';
    const mileage = first(pageText, /\b[\d,\s]+\s*km\b/i);
    const fuel = first(pageText, /\b(?:Diesel|Petrol|Electric|Hybrid|LPG)\b/i);
    const transmission = first(pageText, /\b(?:Automatic|Manual)\b/i);
    const seats = first(pageText, /\b\d+\s+seats\b/i);
    const model = brand ? clean(title.replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, 'i'))) : title;
    const photos = [...document.querySelectorAll('app-header-details-images img, [class*="gallery" i] img, [class*="image" i] img')]
      .map(image => image.currentSrc || image.src).filter(isImage);

    return {
      title,
      fields: { brand, model, year, mileage, color: detail(root, 'Color'), engine: detail(root, 'Engine') || detail(root, 'Engine capacity'), transmission },
      details: {
        vehicleCategory: detail(root, 'Vehicle Category'),
        registrationNumber: detail(root, 'Registration Number'),
        storageLocation: detail(root, 'Storage location name'),
        numberOfKeys: detail(root, 'Number of Keys'),
        registrationDate,
        fuel,
        seats,
        co2: detail(root, 'CO2 Emission'),
        emissionClass: detail(root, 'Greenhouse Gas Emission Class')
      },
      photos,
      photoApis: []
    };
  }

  function detail(root, label) {
    const wanted = normalize(label);
    const labels = [...root.querySelectorAll('td, th, dt, div, span, strong, b')]
      .filter(element => normalize(element.textContent) === wanted);
    for (const element of labels) {
      const sibling = element.nextElementSibling;
      if (sibling && clean(sibling.textContent)) return clean(sibling.textContent);
      const parent = element.parentElement;
      if (!parent) continue;
      const cells = [...parent.children].map(child => clean(child.textContent)).filter(Boolean);
      const position = cells.findIndex(value => normalize(value) === wanted);
      if (position >= 0 && cells[position + 1]) return cells[position + 1];
    }
    return '';
  }

  function first(text, pattern) { return clean(text.match(pattern)?.[0]); }
  function isImage(url) { return /^https?:/i.test(url) && !/logo|icon|avatar|sprite|placeholder/i.test(url); }
  function normalize(value) { return clean(value).replace(/[:*]/g, '').toLowerCase(); }
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
})();
