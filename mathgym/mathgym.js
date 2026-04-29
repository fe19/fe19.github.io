/* ── State ── */
let category = 'addition';
let difficulty = 'easy';
let questions = [];
let current = 0;
let score = 0;
let timerStart = 0;
let timerInterval = null;
let lastEntryId = null;

/* ── Screen navigation ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'leaderboard') renderLeaderboard();
}

/* ── Button groups ── */
document.querySelectorAll('.btn-group').forEach(group => {
  group.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    group.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (group.id === 'category-btns') category = btn.dataset.val;
    if (group.id === 'difficulty-btns') difficulty = btn.dataset.val;
  });
});

/* ── Question generation ── */
const RANGES = {
  easy:         { add: [1, 10],    mul: [1, 10],   divMax: 10   },
  medium:       { add: [10, 100],  mul: [2, 15],   divMax: 100  },
  hard:         { add: [50, 500],  mul: [10, 30],  divMax: 200  },
  'extra-hard': { add: [100, 2000], mul: [20, 100], divMax: 1000 },
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion(cat, diff) {
  const r = RANGES[diff];
  if (cat === 'mixed') cat = ['addition', 'multiplication', 'division'][rand(0, 2)];

  let a, b, answer, text;

  if (cat === 'addition') {
    a = rand(r.add[0], r.add[1]);
    b = rand(r.add[0], r.add[1]);
    answer = a + b;
    text = `${a} + ${b}`;
  } else if (cat === 'multiplication') {
    a = rand(r.mul[0], r.mul[1]);
    b = rand(r.mul[0], r.mul[1]);
    answer = a * b;
    text = `${a} × ${b}`;
  } else {
    // division: pick b and answer first, so result is always an integer
    b = rand(2, r.mul[1]);
    answer = rand(r.add[0], Math.floor(r.divMax / b));
    a = answer * b;
    text = `${a} ÷ ${b}`;
  }

  return { text: text + ' = ?', answer, choices: makeChoices(answer, cat, diff) };
}

function makeChoices(correct, cat, diff) {
  const set = new Set([correct]);
  const spread = Math.max(5, Math.ceil(correct * 0.3));
  while (set.size < 4) {
    const offset = rand(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    const fake = correct + offset;
    if (fake > 0) set.add(fake);
  }
  return shuffle([...set]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── Quiz flow ── */
function startQuiz() {
  questions = [];
  for (let i = 0; i < 10; i++) questions.push(generateQuestion(category, difficulty));
  current = 0;
  score = 0;
  lastEntryId = null;
  showScreen('quiz');
  startTimer();
  renderQuestion();
}

function renderQuestion() {
  const q = questions[current];
  document.getElementById('quiz-counter').textContent = `${current + 1} / 10`;
  document.getElementById('progress-fill').style.width = `${(current / 10) * 100}%`;
  document.getElementById('question-text').textContent = q.text;

  const container = document.getElementById('answers');
  container.innerHTML = '';
  q.choices.forEach(val => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = val;
    btn.onclick = () => handleAnswer(btn, val, q.answer);
    container.appendChild(btn);
  });
}

function handleAnswer(btn, chosen, correct) {
  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach(b => {
    b.classList.add('disabled');
    if (parseInt(b.textContent) === correct) b.classList.add('correct');
  });

  if (chosen === correct) {
    score++;
  } else {
    btn.classList.add('wrong');
  }

  setTimeout(() => {
    current++;
    if (current < 10) {
      renderQuestion();
    } else {
      endQuiz();
    }
  }, 600);
}

/* ── Timer ── */
function startTimer() {
  timerStart = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = String(elapsed % 60).padStart(2, '0');
  document.getElementById('quiz-timer').textContent = `${min}:${sec}`;
}

function getElapsed() {
  return Math.floor((Date.now() - timerStart) / 1000);
}

/* ── End quiz ── */
function endQuiz() {
  clearInterval(timerInterval);
  const elapsed = getElapsed();
  const min = Math.floor(elapsed / 60);
  const sec = String(elapsed % 60).padStart(2, '0');

  document.getElementById('final-score').textContent = score;
  document.getElementById('result-details').textContent =
    `${capitalize(category)} · ${capitalize(difficulty)} · ${min}:${sec}`;

  lastEntryId = saveScore(score, category, difficulty, elapsed);
  showScreen('result');
}

/* ── Leaderboard ── */
function getScores() {
  return JSON.parse(localStorage.getItem('mathgym_scores') || '[]');
}

function saveScore(score, cat, diff, time) {
  const scores = getScores();
  const id = Date.now();
  scores.push({ id, score, category: cat, difficulty: diff, time, date: new Date().toLocaleDateString() });
  localStorage.setItem('mathgym_scores', JSON.stringify(scores));
  return id;
}

function clearLeaderboard() {
  localStorage.removeItem('mathgym_scores');
  renderLeaderboard();
}

let lbFilter = 'all';

function renderLeaderboard() {
  const scores = getScores();
  const filters = document.getElementById('lb-filters');
  const cats = ['all', 'addition', 'multiplication', 'division', 'mixed'];
  filters.innerHTML = '';
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (lbFilter === c ? ' selected' : '');
    btn.textContent = capitalize(c);
    btn.onclick = () => { lbFilter = c; renderLeaderboard(); };
    filters.appendChild(btn);
  });

  let filtered = lbFilter === 'all' ? scores : scores.filter(s => s.category === lbFilter);
  filtered.sort((a, b) => b.score - a.score || a.time - b.time);

  const tbody = document.getElementById('lb-body');
  const empty = document.getElementById('lb-empty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map((s, i) => {
    const min = Math.floor(s.time / 60);
    const sec = String(s.time % 60).padStart(2, '0');
    const highlight = s.id === lastEntryId ? ' class="highlight"' : '';
    return `<tr${highlight}>
      <td>${i + 1}</td>
      <td>${s.score}/10</td>
      <td>${capitalize(s.category)}</td>
      <td>${capitalize(s.difficulty)}</td>
      <td>${min}:${sec}</td>
      <td>${s.date}</td>
    </tr>`;
  }).join('');
}

/* ── Helpers ── */
function capitalize(s) { return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-'); }

