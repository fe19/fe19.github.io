// --- Storage ---
function loadTasks() {
  return JSON.parse(localStorage.getItem('planer-tasks')) || [];
}

function saveTasks(tasks) {
  localStorage.setItem('planer-tasks', JSON.stringify(tasks));
}

// --- State ---
let tasks = loadTasks();
let currentView = 'calendar';
let currentYear, currentMonth;
let editingTaskId = null;

const today = new Date();
currentYear = today.getFullYear();
currentMonth = today.getMonth();

// --- DOM refs ---
const calendarView = document.getElementById('calendar-view');
const listView = document.getElementById('list-view');
const calendarGrid = document.getElementById('calendar-grid');
const monthLabel = document.getElementById('calendar-month-label');
const listContainer = document.getElementById('list-container');
const modal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const taskForm = document.getElementById('task-form');
const inputTitle = document.getElementById('input-title');
const inputDesc = document.getElementById('input-desc');
const inputDate = document.getElementById('input-date');
const inputRecurrence = document.getElementById('input-recurrence');
const inputColor = document.getElementById('input-color');
const colorSwatches = document.getElementById('color-swatches');
const btnDelete = document.getElementById('btn-delete');
const btnAdd = document.getElementById('btn-add');
const btnCalendar = document.getElementById('btn-calendar');
const btnList = document.getElementById('btn-list');

// --- Helpers ---
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr() {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

function daysDiff(a, b) {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

function taskOccursOn(task, dateStr) {
  const taskDate = new Date(task.date + 'T00:00:00');
  const checkDate = new Date(dateStr + 'T00:00:00');
  if (checkDate < taskDate) return false;

  switch (task.recurrence) {
    case 'none':
      return task.date === dateStr;
    case 'daily':
      return true;
    case 'weekly':
      return daysDiff(taskDate, checkDate) % 7 === 0;
    case 'monthly':
      return checkDate.getDate() === taskDate.getDate();
    case 'yearly':
      return checkDate.getMonth() === taskDate.getMonth() &&
             checkDate.getDate() === taskDate.getDate();
    default:
      return false;
  }
}

// --- Modal ---
function setColorSwatch(color) {
  const c = color || '#40504b';
  inputColor.value = c;
  colorSwatches.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === c);
  });
}

function openModal(taskId, prefillDate) {
  editingTaskId = taskId || null;
  taskForm.reset();

  if (editingTaskId) {
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;
    modalTitle.textContent = 'Edit Task';
    inputTitle.value = task.title;
    inputDesc.value = task.description;
    inputDate.value = task.date;
    inputRecurrence.value = task.recurrence;
    setColorSwatch(task.color);
    btnDelete.classList.remove('hidden');
  } else {
    modalTitle.textContent = 'Add Task';
    inputDate.value = prefillDate || todayStr();
    setColorSwatch('#40504b');
    btnDelete.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  inputTitle.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  editingTaskId = null;
}

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = inputTitle.value.trim();
  if (!title) return;

  if (editingTaskId) {
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) {
      tasks[idx].title = title;
      tasks[idx].description = inputDesc.value.trim();
      tasks[idx].date = inputDate.value;
      tasks[idx].recurrence = inputRecurrence.value;
      tasks[idx].color = inputColor.value;
    }
  } else {
    tasks.push({
      id: crypto.randomUUID(),
      title,
      description: inputDesc.value.trim(),
      date: inputDate.value,
      recurrence: inputRecurrence.value,
      color: inputColor.value,
      completed: false,
      createdAt: new Date().toISOString()
    });
  }

  saveTasks(tasks);
  closeModal();
  render();
});

btnDelete.addEventListener('click', () => {
  if (editingTaskId) {
    tasks = tasks.filter(t => t.id !== editingTaskId);
    saveTasks(tasks);
    closeModal();
    render();
  }
});

colorSwatches.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  inputColor.value = swatch.dataset.color;
  colorSwatches.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  swatch.classList.add('selected');
});

document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

// --- Swiss Holidays ---
function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function dateToStr(date) {
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getSwissHolidays(year) {
  const easter = easterDate(year);
  return [
    { date: toDateStr(year, 0, 1),                  name: 'New Year\'s Day' },
    { date: toDateStr(year, 0, 2),                  name: 'Berchtoldstag' },
    { date: dateToStr(addDays(easter, -2)),          name: 'Good Friday' },
    { date: dateToStr(easter),                       name: 'Easter Sunday' },
    { date: dateToStr(addDays(easter, 1)),           name: 'Easter Monday' },
    { date: dateToStr(addDays(easter, 39)),          name: 'Ascension Day' },
    { date: dateToStr(addDays(easter, 49)),          name: 'Whit Sunday' },
    { date: dateToStr(addDays(easter, 50)),          name: 'Whit Monday' },
    { date: toDateStr(year, 7, 1),                  name: 'Swiss National Day' },
    { date: toDateStr(year, 11, 25),                name: 'Christmas Day' },
    { date: toDateStr(year, 11, 26),                name: 'St. Stephen\'s Day' },
  ];
}

function holidayMapForYear(year) {
  const map = {};
  getSwissHolidays(year).forEach(h => { map[h.date] = h.name; });
  return map;
}

// --- Calendar ---
function renderCalendar() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0

  const todayDate = todayStr();
  const holidays = holidayMapForYear(currentYear);
  let html = '';

  // Empty cells before first day
  for (let i = 0; i < startWeekday; i++) {
    html += '<div class="calendar-cell empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(currentYear, currentMonth, day);
    const isToday = dateStr === todayDate;
    const holiday = holidays[dateStr];
    const dayTasks = tasks.filter(t => taskOccursOn(t, dateStr));

    html += `<div class="calendar-cell${isToday ? ' today' : ''}${holiday ? ' holiday-cell' : ''}" data-date="${dateStr}">`;
    html += `<div class="day-number">${day}</div>`;

    if (holiday) {
      html += `<span class="holiday-label">${escapeHtml(holiday)}</span>`;
    }

    const maxShow = 3;
    dayTasks.slice(0, maxShow).forEach(t => {
      const c = t.color || '#40504b';
      const done = t.completed ? ' task-done' : '';
      html += `<span class="task-dot${done}" data-id="${t.id}" style="background:${c}"></span>`;
      html += `<span class="task-title${done}" data-id="${t.id}" style="background:${c}1a;color:${c}">${escapeHtml(t.title)}</span>`;
    });
    if (dayTasks.length > maxShow) {
      html += `<span class="more-tasks">+${dayTasks.length - maxShow}</span>`;
    }

    html += '</div>';
  }

  calendarGrid.innerHTML = html;

  // Click & hover handlers
  calendarGrid.querySelectorAll('.calendar-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const taskEl = e.target.closest('[data-id]');
      if (taskEl) {
        openModal(taskEl.dataset.id);
      } else {
        openModal(null, cell.dataset.date);
      }
    });
  });

  calendarGrid.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const task = tasks.find(t => t.id === el.dataset.id);
      if (task) showTooltip(task, el);
    });
    el.addEventListener('mouseleave', hideTooltip);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('btn-prev').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  render();
});

document.getElementById('btn-next').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  render();
});

// --- List ---
function renderList() {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const holidays = holidayMapForYear(currentYear);

  // Collect all dated entries: tasks and holidays
  const entries = []; // {dateStr, task?, holidayName?}

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(currentYear, currentMonth, day);
    if (holidays[dateStr]) {
      entries.push({ dateStr, holidayName: holidays[dateStr] });
    }
    tasks.forEach(task => {
      if (taskOccursOn(task, dateStr)) {
        entries.push({ dateStr, task });
      }
    });
  }

  // Sort: by date; within same date holidays first, then incomplete tasks, then completed
  entries.sort((a, b) => {
    const dateCmp = a.dateStr.localeCompare(b.dateStr);
    if (dateCmp !== 0) return dateCmp;
    if (a.holidayName && !b.holidayName) return -1;
    if (!a.holidayName && b.holidayName) return 1;
    if (a.task && b.task) return a.task.completed === b.task.completed ? 0 : a.task.completed ? 1 : -1;
    return 0;
  });

  if (entries.length === 0) {
    listContainer.innerHTML = '<div class="list-empty">No tasks this month.</div>';
    return;
  }

  let html = '';
  let lastDate = '';

  entries.forEach(({ dateStr, task, holidayName }) => {
    if (dateStr !== lastDate) {
      if (lastDate) html += '</div>';
      html += `<div class="list-date-group"><div class="list-date-label">${formatDate(dateStr)}</div>`;
      lastDate = dateStr;
    }

    if (holidayName) {
      html += `<div class="holiday-entry">${escapeHtml(holidayName)}</div>`;
      return;
    }

    const recurrenceLabel = task.recurrence !== 'none'
      ? `<span class="task-badge">${task.recurrence}</span>` : '';

    const c = task.color || '#40504b';
    html += `<div class="task-card${task.completed ? ' completed' : ''}" data-id="${task.id}" style="border-left:3px solid ${c}">
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
      <div class="task-info">
        <div class="task-info-title">${escapeHtml(task.title)} ${recurrenceLabel}</div>
        ${task.description ? `<div class="task-info-desc">${escapeHtml(task.description)}</div>` : ''}
      </div>
    </div>`;
  });

  if (lastDate) html += '</div>';

  listContainer.innerHTML = html;

  // Click handlers
  listContainer.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('task-checkbox')) return;
      openModal(card.dataset.id);
    });
    card.addEventListener('mouseenter', () => {
      const task = tasks.find(t => t.id === card.dataset.id);
      if (task) showTooltip(task, card);
    });
    card.addEventListener('mouseleave', hideTooltip);
  });

  listContainer.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const task = tasks.find(t => t.id === cb.dataset.id);
      if (task) {
        task.completed = cb.checked;
        saveTasks(tasks);
        renderList();
      }
    });
  });
}

// --- View Toggle ---
btnCalendar.addEventListener('click', () => {
  currentView = 'calendar';
  calendarView.classList.remove('hidden');
  listView.classList.add('hidden');
  btnCalendar.classList.add('active');
  btnList.classList.remove('active');
  renderCalendar();
});

btnList.addEventListener('click', () => {
  currentView = 'list';
  listView.classList.remove('hidden');
  calendarView.classList.add('hidden');
  btnList.classList.add('active');
  btnCalendar.classList.remove('active');
  renderList();
});

// --- Tooltip ---
const tooltip = document.getElementById('task-tooltip');

function showTooltip(task, anchorEl) {
  const c = task.color || '#40504b';
  const recLabel = task.recurrence !== 'none' ? `<span class="tooltip-badge" style="background:${c}1a;color:${c}">${task.recurrence}</span>` : '';
  const doneLabel = task.completed ? '<span class="tooltip-done">Completed</span>' : '';
  tooltip.innerHTML = `
    <div class="tooltip-header" style="border-left:3px solid ${c}">
      <span class="tooltip-title">${escapeHtml(task.title)}</span>
      ${recLabel}${doneLabel}
    </div>
    ${task.description ? `<div class="tooltip-desc">${escapeHtml(task.description)}</div>` : ''}
    <div class="tooltip-date">${formatDate(task.date)}</div>
  `;
  tooltip.classList.remove('hidden');

  const rect = anchorEl.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 6;

  if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
  if (top + th > window.innerHeight + window.scrollY - 8) top = rect.top + window.scrollY - th - 6;

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

// --- Export / Import ---
document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(tasks, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planer-tasks-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      tasks = imported;
      saveTasks(tasks);
      render();
    } catch {
      alert('Invalid JSON file.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// --- FAB ---
btnAdd.addEventListener('click', () => openModal());

// --- Render ---
function render() {
  if (currentView === 'calendar') {
    renderCalendar();
  } else {
    renderList();
  }
}

// --- Init ---
render();

