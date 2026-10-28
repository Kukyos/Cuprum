// E-waste collection portal: form validation, geolocation, and saving requests in localStorage.
// ponytail: requests live in this browser only; a real portal would POST them to a server.

const KEY = 'cuprum-pickups';
const form = document.getElementById('pickup-form');
const msg = document.getElementById('form-msg');
const list = document.getElementById('request-list');
const empty = document.getElementById('empty');
const locateBtn = document.getElementById('locate-btn');
const locateStatus = document.getElementById('locate-status');
const map = document.getElementById('map');

// ---------- Storage ----------
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save(requests) {
  try { localStorage.setItem(KEY, JSON.stringify(requests)); return true; } catch { return false; }
}

// ---------- Date: earliest pickup is tomorrow, latest 30 days out ----------
// Built from local date parts, not toISOString(), which is UTC and can be a day off.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dateInput = document.getElementById('date');
const day = new Date();
day.setDate(day.getDate() + 1);
dateInput.min = dateInput.value = ymd(day);
day.setDate(day.getDate() + 29);
dateInput.max = ymd(day);

// ---------- Prefill an item from the scanner: pickup.html?item=battery ----------
const preset = new URLSearchParams(location.search).get('item');
const presetBox = preset && form.querySelector(`input[name="items"][value="${CSS.escape(preset)}"]`);
if (presetBox) presetBox.checked = true;

// ---------- Location ----------
function showMap(lat, lon) {
  const d = 0.004; // about 400 m around the point
  map.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&layer=mapnik&marker=${lat},${lon}`;
  map.hidden = false;
}

locateBtn.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    locateStatus.textContent = 'Your browser cannot share location. Type the address instead.';
    locateStatus.className = 'hint bad';
    return;
  }
  locateBtn.disabled = true;
  locateStatus.className = 'hint';
  locateStatus.textContent = 'Finding you…';

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    form.elements.lat.value = lat.toFixed(6);
    form.elements.lon.value = lon.toFixed(6);
    showMap(lat, lon);
    locateStatus.textContent = `Located (accurate to about ${Math.round(accuracy)} m). Looking up the address…`;

    // Turn coordinates into a street address with OpenStreetMap's free geocoder.
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (data.display_name) form.elements.address.value = data.display_name;
      locateStatus.textContent = 'Address filled in. Check it and add your house number.';
    } catch {
      locateStatus.textContent = 'Got your location, but not the street address. Please type it in.';
    }
    locateBtn.disabled = false;
  }, (err) => {
    const reasons = {
      1: 'Location permission was denied.',
      2: 'Your location is unavailable right now.',
      3: 'Finding your location took too long.',
    };
    locateStatus.textContent = `${reasons[err.code] || 'Could not get your location.'} Type the address instead.`;
    locateStatus.className = 'hint bad';
    locateBtn.disabled = false;
  }, { enableHighAccuracy: true, timeout: 15000 });
});

// ---------- Submit ----------
const itemsError = document.getElementById('items-error');
const itemBoxes = [...form.querySelectorAll('input[name="items"]')];
itemBoxes.forEach((b) => b.addEventListener('change', () => { itemsError.hidden = true; }));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  form.classList.add('tried');
  const items = itemBoxes.filter((b) => b.checked).map((b) => b.parentElement.textContent.trim());
  itemsError.hidden = items.length > 0;

  if (!form.checkValidity() || !items.length) {
    msg.textContent = 'Please fix the highlighted fields.';
    msg.className = 'form-msg bad';
    (form.querySelector(':invalid:not(fieldset)') || itemBoxes[0]).focus();
    return;
  }

  const f = form.elements;
  const request = {
    id: 'EW-' + Date.now().toString(36).toUpperCase(),
    items,
    size: f.size.value,
    address: f.address.value.trim(),
    landmark: f.landmark.value.trim(),
    lat: f.lat.value || null,
    lon: f.lon.value || null,
    date: f.date.value,
    slot: f.slot.value,
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    email: f.email.value.trim(),
    notes: f.notes.value.trim(),
    status: 'scheduled',
    created: new Date().toISOString(),
  };

  const requests = load();
  requests.unshift(request);
  if (!save(requests)) {
    msg.textContent = 'Could not save the request in this browser (storage is blocked).';
    msg.className = 'form-msg bad';
    return;
  }

  form.reset();
  form.classList.remove('tried');
  dateInput.value = dateInput.min;
  map.hidden = true;
  locateStatus.textContent = '';
  msg.textContent = `Booked! Your request ID is ${request.id}. The collector will call ${request.phone} before arriving.`;
  msg.className = 'form-msg ok';
  render(request.id);
});

// ---------- Request list ----------
function prettyDate(s) {
  return new Date(s + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function render(flashId) {
  const requests = load();
  empty.hidden = requests.length > 0;
  list.replaceChildren(...requests.map((r) => {
    const li = document.createElement('li');
    li.className = r.status === 'cancelled' ? 'is-cancelled' : '';
    if (r.id === flashId) li.classList.add('flash');

    const head = document.createElement('div');
    head.className = 'head';
    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = r.id;
    const status = document.createElement('span');
    status.className = `status ${r.status}`;
    status.textContent = r.status;
    head.append(id, status);

    const when = document.createElement('div');
    when.textContent = `${prettyDate(r.date)}, ${r.slot}`;
    const what = document.createElement('div');
    what.className = 'meta';
    what.textContent = `${r.items.join(', ')} · ${r.size}`;
    const where = document.createElement('div');
    where.className = 'meta';
    where.textContent = r.address;
    li.append(head, when, what, where);

    if (r.status === 'scheduled') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn small';
      cancel.textContent = 'Cancel pickup';
      cancel.style.justifySelf = 'start';
      cancel.style.marginTop = '6px';
      cancel.addEventListener('click', () => {
        const all = load();
        const target = all.find((x) => x.id === r.id);
        if (target) target.status = 'cancelled';
        save(all);
        render();
      });
      li.append(cancel);
    }
    return li;
  }));
}

render();
