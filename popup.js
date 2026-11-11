const chooseButton = document.querySelector('#choose');
const saveButton = document.querySelector('#save');
const folderLabel = document.querySelector('#folder');
const status = document.querySelector('#status');
const lotField = document.querySelector('#lot-field');
const lotNumber = document.querySelector('#lot-number');
const photoCountField = document.querySelector('#photo-count-field');
const photoCount = document.querySelector('#photo-count');
let directoryHandle;

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  try {
    const isAyvens = new URL(tab?.url || '').hostname === 'carmarket.ayvens.com';
    lotField.hidden = !isAyvens;
    photoCountField.hidden = !isAyvens;
  } catch {
    lotField.hidden = true;
    photoCountField.hidden = true;
  }
});

chooseButton.addEventListener('click', async () => {
  try {
    directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    folderLabel.textContent = directoryHandle.name;
    saveButton.disabled = false;
    setStatus('');
  } catch (error) {
    if (error.name !== 'AbortError') setStatus('Не удалось открыть выбор папки.', true);
  }
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  setStatus('Собираю данные лота и фотографии…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const ayvensLotNumber = lotField.hidden ? '' : lotNumber.value.trim();
    const ayvensPhotoCount = photoCountField.hidden ? '' : photoCount.value.trim();
    if (!lotField.hidden && (!/^\d+$/.test(ayvensLotNumber) || !/^\d+$/.test(ayvensPhotoCount) || Number(ayvensPhotoCount) < 1)) {
      throw new Error('Введите номер лота и количество фотографий Ayvens — только положительные числа.');
    }
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'extractLot', lotNumber: ayvensLotNumber, photoCount: ayvensPhotoCount });
    if (result?.error) throw new Error(result.error);
    if (!result?.title) throw new Error('Не удалось определить название лота на этой странице.');
    const folderName = safeName(folderNameFor(result));
    const lotDirectory = await directoryHandle.getDirectoryHandle(folderName, { create: true });
    await writeText(lotDirectory, 'info.txt', makeInfo(result));
    let extraFilesSaved = 0;
    for (const file of result.extraFiles || []) {
      if (file?.name && typeof file.content === 'string') {
        await writeText(lotDirectory, safeName(file.name), file.content);
        extraFilesSaved += 1;
      }
    }
    const apiPhotos = await resolvePhotoApis(result.photoApis || []);
    const photos = unique([...(result.photos || []), ...apiPhotos]);
    let saved = 0;
    for (const photo of photos) {
      try { await writePhoto(lotDirectory, photo, saved + 1); saved += 1; }
      catch (error) { console.warn('Photo skipped', photo, error); }
    }
    const extras = extraFilesSaved ? ` Доп. файлов: ${extraFilesSaved}.` : '';
    setStatus(`Готово: ${folderName}. Сохранено фото: ${saved}.${extras}`, false, true);
  } catch (error) {
    setStatus(error.message || 'Не удалось сохранить лот.', true);
  } finally { saveButton.disabled = false; }
});

function makeInfo(data) {
  const labels = [
    ['brand', 'Марка'], ['model', 'Модель'], ['year', 'Год выпуска'], ['mileage', 'Пробег'],
    ['color', 'Цвет'], ['engine', 'Двигатель'], ['transmission', 'Трансмиссия'], ['fuel', 'Топливо'],
    ['registrationDate', 'Дата первой регистрации'], ['vin', 'VIN'], ['storageLocation', 'Место хранения'],
    ['seats', 'Количество мест']
  ];
  const values = { ...(data.fields || {}), ...(data.details || {}) };
  const omitted = new Set(data.omitFields || []);
  return labels.filter(([key]) => !omitted.has(key)).map(([key, label]) => `${label}: ${values[key] || 'Не указано'}`).join('\n') + '\n';
}
function safeName(value) { return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 120) || 'Автомобиль'; }
function folderNameFor(data) {
  const brand = data.fields?.brand?.trim();
  const model = data.fields?.model?.trim();
  return [brand, model].filter(Boolean).join(' ') || data.title;
}
function unique(items) {
  const urls = new Map();
  for (const item of items.filter(Boolean)) {
    const value = item.replace(/#.*$/, '');
    try {
      const url = new URL(value);
      // BCA serves every vehicle image from the same /Document endpoint; its
      // docId query parameter is the actual image identity.
      const key = /bcaimage\.com\/Document$/i.test(`${url.origin}${url.pathname}`)
        ? `${url.origin}${url.pathname}?DocType=${url.searchParams.get('DocType') || ''}&docId=${url.searchParams.get('docId') || ''}`
        : `${url.origin}${url.pathname}`;
      if (!urls.has(key)) urls.set(key, value);
    } catch { if (!urls.has(value)) urls.set(value, value); }
  }
  return [...urls.values()];
}
async function resolvePhotoApis(endpoints) {
  const urls = new Set();
  for (const endpoint of unique(endpoints)) {
    try {
      const response = await fetch(endpoint, { credentials: 'include' });
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) continue;
      findImageUrls(await response.json(), endpoint, urls);
    } catch (error) { console.warn('Photo API skipped', endpoint, error); }
  }
  return [...urls];
}
function findImageUrls(value, baseUrl, urls) {
  if (typeof value === 'string') {
    try {
      const url = new URL(value, baseUrl).href;
      if (/\.(jpe?g|png|webp|avif)(\?|$)|\/image[s]?\//i.test(url)) urls.add(url);
    } catch { /* Ignore non-URL strings in API responses. */ }
    return;
  }
  if (Array.isArray(value)) value.forEach(item => findImageUrls(item, baseUrl, urls));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => findImageUrls(item, baseUrl, urls));
}
async function writeText(dir, name, text) { const file = await dir.getFileHandle(name, { create: true }); const writer = await file.createWritable(); await writer.write(text); await writer.close(); }
async function writePhoto(dir, url, number) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(response.status);
  const blob = await response.blob();
  const isBcaVehicleImage = /bcaimage\.com\/Document\?DocType=VehicleImage/i.test(url);
  if (!blob.size || (!isBcaVehicleImage && (blob.size < 10 * 1024 || !blob.type.startsWith('image/')))) {
    throw new Error('Response is not a vehicle image');
  }
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[blob.type] || 'jpg';
  const file = await dir.getFileHandle(`${number}.${extension}`, { create: true });
  const writer = await file.createWritable();
  await writer.write(blob);
  await writer.close();
}
function setStatus(message, error = false, success = false) { status.textContent = message; status.className = error ? 'error' : success ? 'success' : ''; }
