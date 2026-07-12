(function () {
    'use strict';

    const STORAGE_KEY = 'coplan.v1';
    const SHARE_VERSION = 1;

    // ---------- State ----------

    let state = loadState();
    let selectedId = state.notes.length ? sortedNotes()[0].id : null;
    let view = null; // 'write' | 'split' | 'preview'
    let pendingImport = null;
    let saveTimer = null;

    const els = {
        author: document.getElementById('author-input'),
        newNote: document.getElementById('new-note-btn'),
        shareAll: document.getElementById('share-all-btn'),
        exportBtn: document.getElementById('export-btn'),
        importBtn: document.getElementById('import-btn'),
        importFile: document.getElementById('import-file'),
        search: document.getElementById('search-input'),
        noteList: document.getElementById('note-list'),
        editorCard: document.querySelector('.coplan-editor-card'),
        emptyState: document.getElementById('empty-state'),
        title: document.getElementById('title-input'),
        content: document.getElementById('content-input'),
        preview: document.getElementById('preview'),
        panes: document.getElementById('editor-panes'),
        shareNote: document.getElementById('share-note-btn'),
        deleteNote: document.getElementById('delete-note-btn'),
        metaLine: document.getElementById('meta-line'),
        wordCount: document.getElementById('word-count'),
        viewButtons: Array.from(document.querySelectorAll('[data-view]')),
        importSummary: document.getElementById('import-summary'),
        confirmImport: document.getElementById('confirm-import-btn'),
        toast: document.getElementById('toast'),
        toastBody: document.getElementById('toast-body'),
    };

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.notes)) {
                    return { author: typeof parsed.author === 'string' ? parsed.author : '', notes: parsed.notes.filter(isValidNote) };
                }
            }
        } catch (e) { /* corrupted storage: start fresh */ }
        return { author: '', notes: [welcomeNote()] };
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SHARE_VERSION, author: state.author, notes: state.notes }));
    }

    function isValidNote(n) {
        return n && typeof n.id === 'string' && typeof n.title === 'string'
            && typeof n.content === 'string' && typeof n.updatedAt === 'number';
    }

    function newId() {
        return (crypto.randomUUID) ? crypto.randomUUID()
            : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function welcomeNote() {
        return {
            id: newId(),
            title: 'Welcome to CoPlan',
            content: [
                '# How CoPlan works',
                '',
                'Write planning notes in **Markdown**. Everything is saved in *your* browser automatically.',
                '',
                '## Working together',
                '- [ ] Set your name in the sidebar',
                '- [ ] Write a plan',
                '- [ ] Press **Share note** and send the link to a teammate',
                '- [x] They import it, edit, and share a link back',
                '',
                'When you open a shared link, notes are merged: a note you already have is only replaced if the shared copy is newer.',
                '',
                '## Markdown you can use',
                'Headings, **bold**, *italic*, ~~strikethrough~~, `code`, lists, task lists, quotes and [links](https://www.markdownguide.org/basic-syntax/).',
                '',
                '> Tip: tick the checkboxes directly in the preview.',
            ].join('\n'),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updatedBy: 'CoPlan',
        };
    }

    function sortedNotes() {
        return state.notes.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    }

    function currentNote() {
        return state.notes.find(n => n.id === selectedId) || null;
    }

    // ---------- Markdown rendering (escape first, then transform) ----------

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderInline(s) {
        s = escapeHtml(s);
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    function renderMarkdown(src) {
        const lines = src.split('\n');
        const out = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            if (/^```/.test(line)) {
                const code = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
                i++; // skip closing fence
                out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
                continue;
            }

            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                const level = heading[1].length;
                out.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
                i++;
                continue;
            }

            if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
                out.push('<hr>');
                i++;
                continue;
            }

            if (/^\s*>/.test(line)) {
                const quote = [];
                while (i < lines.length && /^\s*>/.test(lines[i])) {
                    quote.push(renderInline(lines[i].replace(/^\s*>\s?/, '')));
                    i++;
                }
                out.push('<blockquote>' + quote.join('<br>') + '</blockquote>');
                continue;
            }

            const isListLine = l => /^\s*([-*]|\d+\.)\s+/.test(l);
            if (isListLine(line)) {
                const ordered = /^\s*\d+\./.test(line);
                const items = [];
                let allTasks = true;
                while (i < lines.length && isListLine(lines[i])) {
                    const task = lines[i].match(/^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/);
                    if (task) {
                        const done = task[1].toLowerCase() === 'x';
                        items.push('<li class="task-item' + (done ? ' done' : '') + '">'
                            + '<input type="checkbox" data-line="' + i + '"' + (done ? ' checked' : '') + '>'
                            + '<span class="task-text">' + renderInline(task[2]) + '</span></li>');
                    } else {
                        allTasks = false;
                        items.push('<li>' + renderInline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')) + '</li>');
                    }
                    i++;
                }
                const tag = ordered ? 'ol' : 'ul';
                const cls = (!ordered && allTasks) ? ' class="task-list"' : '';
                out.push('<' + tag + cls + '>' + items.join('') + '</' + tag + '>');
                continue;
            }

            if (line.trim() === '') { i++; continue; }

            const para = [];
            while (i < lines.length && lines[i].trim() !== ''
                && !/^(#{1,6}\s|```|\s*>)/.test(lines[i]) && !isListLine(lines[i])) {
                para.push(renderInline(lines[i]));
                i++;
            }
            out.push('<p>' + para.join('<br>') + '</p>');
        }

        return out.join('\n');
    }

    // ---------- Share links (deflate + base64url in the URL hash) ----------

    function bytesToB64u(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function b64uToBytes(s) {
        s = s.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const bin = atob(s);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    async function encodeShare(obj) {
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
            const buf = await new Response(stream).arrayBuffer();
            return 'c' + bytesToB64u(new Uint8Array(buf));
        }
        return 'p' + bytesToB64u(bytes);
    }

    async function decodeShare(payload) {
        const kind = payload[0];
        const bytes = b64uToBytes(payload.slice(1));
        let json;
        if (kind === 'c') {
            if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress the link.');
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            json = await new Response(stream).text();
        } else if (kind === 'p') {
            json = new TextDecoder().decode(bytes);
        } else {
            throw new Error('Unknown link format.');
        }
        return JSON.parse(json);
    }

    async function shareNotes(notes, label) {
        const payload = await encodeShare({ v: SHARE_VERSION, notes });
        const url = location.origin + location.pathname + '#s=' + payload;
        let copied = false;
        try {
            await navigator.clipboard.writeText(url);
            copied = true;
        } catch (e) { /* clipboard unavailable or denied */ }
        if (!copied) {
            window.prompt('Copy this link:', url);
        } else if (url.length > 8000) {
            toast(label + ' link copied, but it is very long — consider Export JSON for big plans.');
        } else {
            toast(label + ' link copied to clipboard.');
        }
    }

    // ---------- Import / merge ----------

    function classifyIncoming(notes) {
        return notes.filter(isValidNote).map(incoming => {
            const local = state.notes.find(n => n.id === incoming.id);
            let status = 'new';
            if (local) status = incoming.updatedAt > local.updatedAt ? 'update' : 'skip';
            return { note: incoming, status };
        });
    }

    function applyImport(classified) {
        let added = 0, updated = 0;
        classified.forEach(({ note, status }) => {
            if (status === 'new') { state.notes.push(note); added++; }
            else if (status === 'update') {
                const idx = state.notes.findIndex(n => n.id === note.id);
                state.notes[idx] = note;
                updated++;
            }
        });
        if (added + updated > 0) {
            saveState();
            const first = classified.find(c => c.status !== 'skip');
            if (first) selectedId = first.note.id;
            renderAll();
        }
        return { added, updated };
    }

    function showImportModal(notes) {
        const classified = classifyIncoming(notes);
        if (!classified.length) { toast('The shared link contained no valid notes.'); return; }
        if (!window.bootstrap) {
            const summary = classified.map(c => '- ' + (c.note.title || '(untitled)') + ' (' + c.status + ')').join('\n');
            if (confirm('Import these shared notes?\n' + summary)) applyImport(classified);
            return;
        }
        pendingImport = classified;
        els.importSummary.innerHTML = classified.map(({ note, status }) => {
            const badge = status === 'new' ? '<span class="badge text-bg-success">new</span>'
                : status === 'update' ? '<span class="badge text-bg-warning">newer — will replace yours</span>'
                : '<span class="badge text-bg-secondary">older — will be skipped</span>';
            return '<li>' + escapeHtml(note.title || '(untitled)') + ' ' + badge + '</li>';
        }).join('');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('import-modal')).show();
    }

    async function handleShareHash() {
        const m = location.hash.match(/^#s=(.+)$/);
        if (!m) return;
        history.replaceState(null, '', location.pathname + location.search);
        try {
            const data = await decodeShare(m[1]);
            if (!data || !Array.isArray(data.notes)) throw new Error('bad payload');
            showImportModal(data.notes);
        } catch (e) {
            toast('Could not read the shared link (' + e.message + ').');
        }
    }

    // ---------- Rendering ----------

    function fmtTime(ts) {
        const d = new Date(ts);
        const today = new Date();
        const sameDay = d.toDateString() === today.toDateString();
        return sameDay
            ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }

    function renderList() {
        const q = els.search.value.trim().toLowerCase();
        const notes = sortedNotes().filter(n =>
            !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
        els.noteList.innerHTML = '';
        notes.forEach(n => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'list-group-item list-group-item-action px-2' + (n.id === selectedId ? ' active' : '');
            a.setAttribute('role', 'option');
            const title = document.createElement('div');
            title.className = 'note-title text-truncate';
            title.textContent = n.title || '(untitled)';
            const meta = document.createElement('div');
            meta.className = 'note-meta' + (n.id === selectedId ? '' : ' text-muted');
            meta.textContent = fmtTime(n.updatedAt) + (n.updatedBy ? ' · ' + n.updatedBy : '');
            a.append(title, meta);
            a.addEventListener('click', e => {
                e.preventDefault();
                selectedId = n.id;
                renderAll();
            });
            els.noteList.appendChild(a);
        });
        if (!notes.length) {
            const div = document.createElement('div');
            div.className = 'text-muted small px-2 py-3';
            div.textContent = q ? 'No notes match your search.' : 'No notes yet.';
            els.noteList.appendChild(div);
        }
    }

    function renderEditor() {
        const note = currentNote();
        els.editorCard.classList.toggle('d-none', !note);
        els.emptyState.classList.toggle('d-none', !!note);
        if (!note) return;
        if (document.activeElement !== els.title) els.title.value = note.title;
        if (document.activeElement !== els.content) els.content.value = note.content;
        els.preview.innerHTML = renderMarkdown(note.content);
        els.metaLine.textContent = 'Edited ' + fmtTime(note.updatedAt) + (note.updatedBy ? ' by ' + note.updatedBy : '');
        const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
        els.wordCount.textContent = words + ' word' + (words === 1 ? '' : 's');
    }

    function setView(v) {
        view = v;
        els.panes.classList.remove('write', 'split', 'preview');
        els.panes.classList.add(v);
        els.viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === v));
    }

    function renderAll() {
        renderList();
        renderEditor();
    }

    function toast(msg) {
        els.toastBody.textContent = msg;
        if (window.bootstrap) {
            bootstrap.Toast.getOrCreateInstance(els.toast).show();
        } else {
            els.toast.classList.add('show');
            setTimeout(() => els.toast.classList.remove('show'), 4000);
        }
    }

    // ---------- Mutations ----------

    function touch(note) {
        note.updatedAt = Date.now();
        note.updatedBy = state.author || 'anonymous';
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveState(); renderList(); }, 400);
    }

    // ---------- Events ----------

    els.author.addEventListener('input', () => {
        state.author = els.author.value.trim();
        scheduleSave();
    });

    els.newNote.addEventListener('click', () => {
        const note = {
            id: newId(),
            title: '',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            updatedBy: state.author || 'anonymous',
        };
        state.notes.push(note);
        selectedId = note.id;
        saveState();
        renderAll();
        els.title.focus();
    });

    els.title.addEventListener('input', () => {
        const note = currentNote();
        if (!note) return;
        note.title = els.title.value;
        touch(note);
        scheduleSave();
        renderEditor();
    });

    els.content.addEventListener('input', () => {
        const note = currentNote();
        if (!note) return;
        note.content = els.content.value;
        touch(note);
        scheduleSave();
        renderEditor();
    });

    els.deleteNote.addEventListener('click', () => {
        const note = currentNote();
        if (!note) return;
        if (!confirm('Delete "' + (note.title || 'untitled') + '"? This cannot be undone.')) return;
        state.notes = state.notes.filter(n => n.id !== note.id);
        selectedId = state.notes.length ? sortedNotes()[0].id : null;
        saveState();
        renderAll();
    });

    els.shareNote.addEventListener('click', () => {
        const note = currentNote();
        if (note) shareNotes([note], 'Note');
    });

    els.shareAll.addEventListener('click', () => {
        if (!state.notes.length) { toast('Nothing to share yet.'); return; }
        shareNotes(state.notes, 'Workspace');
    });

    els.search.addEventListener('input', renderList);

    els.viewButtons.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

    // Tick task checkboxes directly in the preview.
    els.preview.addEventListener('change', e => {
        const box = e.target.closest('input[type="checkbox"][data-line]');
        const note = currentNote();
        if (!box || !note) return;
        const lineNo = Number(box.dataset.line);
        const lines = note.content.split('\n');
        if (lineNo >= 0 && lineNo < lines.length) {
            lines[lineNo] = box.checked
                ? lines[lineNo].replace(/\[( )\]/, '[x]')
                : lines[lineNo].replace(/\[(x|X)\]/, '[ ]');
            note.content = lines.join('\n');
            touch(note);
            saveState();
            renderAll();
        }
    });

    els.confirmImport.addEventListener('click', () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('import-modal')).hide();
        if (!pendingImport) return;
        const { added, updated } = applyImport(pendingImport);
        pendingImport = null;
        toast('Imported ' + added + ' new and updated ' + updated + ' note' + (updated === 1 ? '' : 's') + '.');
    });

    els.exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ v: SHARE_VERSION, notes: state.notes }, null, 2)],
            { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'coplan-notes-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
    });

    els.importBtn.addEventListener('click', () => els.importFile.click());

    els.importFile.addEventListener('change', () => {
        const file = els.importFile.files[0];
        els.importFile.value = '';
        if (!file) return;
        file.text().then(text => {
            const data = JSON.parse(text);
            if (!data || !Array.isArray(data.notes)) throw new Error('bad file');
            showImportModal(data.notes);
        }).catch(() => toast('Could not read that file — expected a CoPlan JSON export.'));
    });

    window.addEventListener('hashchange', handleShareHash);

    // ---------- Init ----------

    els.author.value = state.author;
    setView(window.matchMedia('(min-width: 992px)').matches ? 'split' : 'write');
    renderAll();
    handleShareHash();
})();
