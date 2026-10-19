// Buzzer-Runde: gemeinsamer Buzzer ohne Spielleiter.
//
// Sync läuft über einen öffentlichen MQTT-Broker (WebSocket). Pro Gruppe gibt es
// unter `fe19-buzzer/v1/<CODE>/` drei Arten von Topics, alle "retained", damit
// später Beitretende sofort den aktuellen Stand sehen:
//   state            {seq, type: "open"|"reset", by, byName}  aktuelle Runde
//   presence/<id>    {name}                                    wer gerade da ist
//   buzz/<id>        {seq, ms, name}                           wer wann gedrückt hat
// Gemessen wird die Reaktionszeit auf jedem Gerät ab dem Moment, in dem die
// Freigabe dort ankommt. Damit spielen unterschiedliche Geräte-Uhren keine Rolle.

(() => {
    "use strict";

    const params = new URLSearchParams(location.search);
    const BROKER = params.get("broker") || "wss://broker.hivemq.com:8884/mqtt";
    const NS = "fe19-buzzer/v1";
    const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const CODE_LEN = 5;
    const HEARTBEAT_MS = 25000;
    const STALE_MS = 70000;
    const MAX_PAYLOAD = 1024;

    const $ = id => document.getElementById(id);
    const store = {
        get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
        set(area, k, v) { try { window[area].setItem(k, v); } catch { /* storage blocked */ } }
    };

    function randomString(len, chars) {
        const buf = new Uint32Array(len);
        crypto.getRandomValues(buf);
        return Array.from(buf, n => chars[n % chars.length]).join("");
    }

    // Eine ID pro Browser-Tab, damit zwei Tabs zwei Spieler sein können.
    let myId = store.get("sessionStorage", "buzzer-id");
    if (!myId || !/^[a-z0-9]{10}$/.test(myId)) {
        myId = randomString(10, "abcdefghijklmnopqrstuvwxyz0123456789");
        store.set("sessionStorage", "buzzer-id", myId);
    }

    let name = store.get("localStorage", "buzzer-name") || "";
    let code = "";
    let client = null;
    let connected = false;
    let heartbeat = null;

    const EMPTY_STATE = { seq: 0, type: "reset", by: "", byName: "" };
    let G = EMPTY_STATE;
    let myBuzz = null;
    const players = new Map();  // id -> {name, seen}
    const buzzes = new Map();   // id -> {seq, ms, name}
    let seenKey = "";
    let seenAt = 0;
    let audio = null;

    // ---------- Hilfsfunktionen ----------

    function normalizeCode(v) {
        return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    function validCode(v) { return new RegExp("^[" + CODE_CHARS + "]{" + CODE_LEN + "}$").test(v); }
    function cleanName(v) { return String(v || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24); }
    function topic(sub) { return NS + "/" + code + "/" + sub; }
    function fmt(ms) { return (ms / 1000).toFixed(2).replace(".", ",") + " s"; }

    function beep(freq, dur) {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            if (audio.state === "suspended") audio.resume();
            const o = audio.createOscillator(), g = audio.createGain();
            o.type = "square"; o.frequency.value = freq;
            g.gain.setValueAtTime(0.12, audio.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
            o.connect(g).connect(audio.destination);
            o.start(); o.stop(audio.currentTime + dur);
        } catch { /* kein Ton verfügbar */ }
    }

    function parse(payload) {
        if (!payload || payload.length === 0 || payload.length > MAX_PAYLOAD) return null;
        try {
            const v = JSON.parse(new TextDecoder().decode(payload));
            return v && typeof v === "object" ? v : null;
        } catch { return null; }
    }

    function publish(sub, obj) {
        if (!client) return;
        const body = obj === null ? "" : JSON.stringify(obj);
        client.publish(topic(sub), body, { qos: 1, retain: true }, () => {});
    }

    // ---------- Spiellogik ----------

    function applyState(s) {
        const prevOpen = G.type === "open";
        G = s;
        const key = G.seq + "|" + G.by;
        if (G.type === "open" && key !== seenKey) {
            seenKey = key;
            seenAt = performance.now();
            if (!prevOpen && G.by !== myId) beep(880, 0.15);
        }
        // Nach einem Reset den eigenen alten Buzz aufräumen.
        if (G.type === "reset" && myBuzz) {
            myBuzz = null;
            buzzes.delete(myId);
            publish("buzz/" + myId, null);
        }
        render();
    }

    function act(type) {
        const s = { seq: G.seq + 1, type, by: myId, byName: name };
        publish("state", s);
        applyState(s);
    }

    function buzz() {
        if (!connected || G.type !== "open" || G.by === myId) return;
        if (myBuzz && myBuzz.seq === G.seq) return;
        const ms = Math.max(0, Math.round(performance.now() - seenAt));
        myBuzz = { seq: G.seq, ms, name };
        buzzes.set(myId, myBuzz);
        publish("buzz/" + myId, myBuzz);
        beep(220, 0.35);
        try { navigator.vibrate && navigator.vibrate(60); } catch { /* ignore */ }
        render();
    }

    function onMessage(t, payload) {
        const prefix = NS + "/" + code + "/";
        if (!t.startsWith(prefix)) return;
        const sub = t.slice(prefix.length);
        const data = parse(payload);

        if (sub === "state") {
            if (!data) return;
            const s = {
                seq: Number.isInteger(data.seq) && data.seq >= 0 ? data.seq : -1,
                type: data.type === "open" ? "open" : data.type === "reset" ? "reset" : "",
                by: String(data.by || "").slice(0, 16),
                byName: cleanName(data.byName)
            };
            // Gleiche Nummer: die später angekommene Nachricht gewinnt. Der Broker
            // liefert allen dieselbe Reihenfolge und behält die letzte als "retained".
            if (s.seq < 0 || !s.type || s.seq < G.seq) return;
            applyState(s);
            return;
        }

        const m = /^(presence|buzz)\/([a-z0-9]{10})$/.exec(sub);
        if (!m) return;
        const [, kind, id] = m;
        if (kind === "presence") {
            if (data && cleanName(data.name)) players.set(id, { name: cleanName(data.name), seen: Date.now() });
            else players.delete(id);
        } else {
            if (data && Number.isInteger(data.seq) && typeof data.ms === "number" && isFinite(data.ms) && data.ms >= 0) {
                buzzes.set(id, { seq: data.seq, ms: Math.round(data.ms), name: cleanName(data.name) || "Jemand" });
            } else {
                buzzes.delete(id);
            }
        }
        render();
    }

    // ---------- Verbindung ----------

    function setConn(state, text) {
        connected = state === "ok";
        $("conn").className = "conn " + state;
        $("connText").textContent = text;
        render();
    }

    function connect() {
        if (typeof mqtt === "undefined") {
            setConn("bad", "Die Verbindungsbibliothek konnte nicht geladen werden. Prüfe deine Internetverbindung und lade neu.");
            return;
        }
        setConn("", "Verbinde …");
        client = mqtt.connect(BROKER, {
            clientId: "fe19bz_" + myId + "_" + randomString(4, "abcdefghijklmnopqrstuvwxyz0123456789"),
            clean: true,
            keepalive: 30,
            reconnectPeriod: 2000,
            connectTimeout: 10000,
            will: { topic: topic("presence/" + myId), payload: "", qos: 1, retain: true }
        });
        client.on("connect", () => {
            client.subscribe(NS + "/" + code + "/#", { qos: 1 }, err => {
                if (err) { setConn("bad", "Gruppe konnte nicht geöffnet werden. Versuch es gleich nochmal."); return; }
                publish("presence/" + myId, { name });
                players.set(myId, { name, seen: Date.now() });
                setConn("ok", "Verbunden");
            });
        });
        client.on("reconnect", () => setConn("", "Verbindung unterbrochen, verbinde neu …"));
        client.on("offline", () => setConn("bad", "Offline. Sobald du wieder Netz hast, geht es weiter."));
        client.on("error", () => setConn("bad", "Verbindungsfehler. Ich versuche es weiter."));
        client.on("message", onMessage);

        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
            if (connected) publish("presence/" + myId, { name });
            const now = Date.now();
            for (const [id, p] of players) if (id !== myId && now - p.seen > STALE_MS) players.delete(id);
            render();
        }, HEARTBEAT_MS);
    }

    function disconnect() {
        clearInterval(heartbeat);
        if (client) {
            publish("presence/" + myId, null);
            if (myBuzz) publish("buzz/" + myId, null);
            const c = client;
            client = null;
            c.end(false, {}, () => {});
        }
        connected = false;
    }

    // ---------- Darstellung ----------

    function render() {
        if ($("game").hidden) return;
        const open = G.type === "open";
        const iOpened = open && G.by === myId;
        const pressed = open && myBuzz && myBuzz.seq === G.seq;

        const list = open
            ? [...buzzes].filter(([id, b]) => b.seq === G.seq && id !== G.by)
                .map(([id, b]) => ({ id, ...b, me: id === myId }))
                .sort((a, b) => a.ms - b.ms || a.id.localeCompare(b.id))
            : [];
        const myPos = list.findIndex(x => x.me) + 1;

        $("status").classList.toggle("open", open);
        $("statusText").textContent = open ? "Freigegeben" : "Gesperrt";
        $("statusSub").textContent = open
            ? (iOpened ? "von dir" : "von " + (G.byName || "Jemand"))
            : (G.seq ? "Bereit für die nächste Runde" : "");

        const b = $("buzz");
        b.classList.remove("off", "done");
        b.textContent = "BUZZ";
        if (!connected) { b.classList.add("off"); $("hint").textContent = "Warte auf die Verbindung."; }
        else if (!open) { b.classList.add("off"); $("hint").textContent = "Warte, bis jemand freigibt."; }
        else if (iOpened) { b.classList.add("off"); $("hint").textContent = "Du hast freigegeben. Jetzt sind die anderen dran."; }
        else if (pressed) {
            b.classList.add("done");
            b.textContent = myPos ? "#" + myPos : "✓";
            $("hint").textContent = myPos === 1 ? "Du warst am schnellsten." : "Gedrückt nach " + fmt(myBuzz.ms) + ".";
        } else { $("hint").textContent = "Drück so schnell du kannst. Leertaste geht auch."; }
        b.setAttribute("aria-disabled", b.classList.contains("off") || b.classList.contains("done") ? "true" : "false");

        const main = $("mainAction");
        main.textContent = open ? "Reset für die nächste Runde" : "Buzzer freigeben";
        main.classList.toggle("ghost", open);

        const ol = $("order");
        ol.textContent = "";
        if (!list.length) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = open ? "Noch niemand hat gedrückt." : "Die Reihenfolge erscheint, sobald gedrückt wird.";
            ol.appendChild(li);
        } else {
            const first = list[0].ms;
            list.forEach((x, i) => {
                const li = document.createElement("li");
                if (i === 0) li.classList.add("first");
                if (x.me) li.classList.add("me");
                const pos = document.createElement("span"); pos.className = "pos"; pos.textContent = String(i + 1);
                const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = x.name;
                const t = document.createElement("span"); t.className = "t"; t.textContent = i === 0 ? fmt(x.ms) : "+" + fmt(x.ms - first);
                li.append(pos, nm, t);
                ol.appendChild(li);
            });
        }

        const pl = $("players");
        pl.textContent = "";
        const all = [...players].sort(([a], [b]) => (a === myId ? -1 : b === myId ? 1 : 0));
        $("playersHead").textContent = "In der Gruppe · " + all.length + " Spieler";
        for (const [id, p] of all) {
            const c = document.createElement("span");
            c.className = "chip" + (id === myId ? " me" : "");
            c.textContent = p.name + (id === myId ? " (du)" : "");
            pl.appendChild(c);
        }
    }

    // ---------- Ablauf ----------

    function shareUrl() { return location.origin + location.pathname + "#" + code; }

    function enterGroup(c) {
        code = c;
        G = EMPTY_STATE; myBuzz = null; seenKey = "";
        players.clear(); buzzes.clear();
        history.replaceState(null, "", "#" + code);
        $("groupCode").textContent = code;
        $("whoName").textContent = name;
        $("home").hidden = true;
        $("game").hidden = false;
        $("who").hidden = false;
        $("shareMsg").textContent = "";
        connect();
        render();
    }

    function leaveGroup() {
        disconnect();
        code = "";
        history.replaceState(null, "", location.pathname + location.search);
        $("game").hidden = true;
        $("who").hidden = true;
        $("home").hidden = false;
        $("codeInput").value = "";
    }

    function requireName() {
        const v = cleanName($("nameInput").value);
        if (!v) { $("nameErr").hidden = false; $("nameInput").focus(); return false; }
        name = v;
        store.set("localStorage", "buzzer-name", v);
        return true;
    }

    $("nameInput").value = name;
    $("nameInput").addEventListener("input", () => { $("nameErr").hidden = true; });
    $("codeInput").addEventListener("input", () => {
        $("codeErr").hidden = true;
        const n = normalizeCode($("codeInput").value);
        if (n !== $("codeInput").value) $("codeInput").value = n;
    });

    $("createBtn").addEventListener("click", () => {
        if (!requireName()) return;
        enterGroup(randomString(CODE_LEN, CODE_CHARS));
    });

    $("joinForm").addEventListener("submit", e => {
        e.preventDefault();
        if (!requireName()) return;
        const c = normalizeCode($("codeInput").value);
        if (!validCode(c)) { $("codeErr").hidden = false; $("codeInput").focus(); return; }
        enterGroup(c);
    });

    $("leave").addEventListener("click", leaveGroup);

    $("shareBtn").addEventListener("click", async () => {
        const url = shareUrl();
        const text = "Komm in meine Buzzer-Runde, Code " + code;
        if (navigator.share) {
            try { await navigator.share({ title: "Buzzer-Runde", text, url }); return; }
            catch (err) { if (err && err.name === "AbortError") return; }
        }
        try {
            await navigator.clipboard.writeText(url);
            $("shareMsg").textContent = "Link kopiert. Schick ihn an die anderen.";
        } catch {
            $("shareMsg").textContent = url;
        }
    });

    $("buzz").addEventListener("pointerdown", e => { e.preventDefault(); buzz(); });
    $("buzz").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buzz(); } });
    document.addEventListener("keydown", e => {
        if (e.code !== "Space" || $("game").hidden) return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (!e.repeat) buzz();
    });

    $("mainAction").addEventListener("click", () => {
        if (!connected) return;
        if (!audio) beep(1, 0.001); // Ton auf iOS freischalten
        act(G.type === "open" ? "reset" : "open");
    });

    window.addEventListener("pagehide", () => {
        if (client && connected) {
            publish("presence/" + myId, null);
            if (myBuzz) publish("buzz/" + myId, null);
        }
    });

    // Link mit #CODE: direkt beitreten, sobald ein Name bekannt ist.
    const fromHash = normalizeCode(location.hash.slice(1));
    if (validCode(fromHash)) {
        $("codeInput").value = fromHash;
        if (name) enterGroup(fromHash);
        else $("nameInput").focus();
    }
})();
