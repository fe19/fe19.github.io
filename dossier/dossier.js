// Dossier48 prototype — i18n toggle + mock order wizard. No data leaves the browser.

const PRICES = { standard: 80, bilingual: 140, executive: 250, rental: 120, letter: 60 };
const EXPRESS_SURCHARGE = 50;

const I18N = {
    en: {
        protoBanner: "Prototype — no real orders are placed and no data leaves your browser.",
        navServices: "Services", navHow: "How it works", navPricing: "Pricing", navFaq: "FAQ",
        navCta: "Start your order",
        heroEyebrow: "Zurich · Geneva · all of Switzerland",
        heroTitle: "Your Swiss application dossier. Polished, tailored, in 48&nbsp;hours.",
        heroLead: "Send us your CV and the job posting. We return a complete, tailored application package — CV, motivation letter, on request in a second language — ready to send within 48 hours.",
        heroCta1: "Start your order", heroCta2: "See how it works",
        heroPoint1: "AI-drafted, always human-finished",
        heroPoint2: "German, French, Italian &amp; English",
        heroPoint3: "Fixed prices from CHF 80",
        docTitle: "Motivation letter", docCheck: "✓ Human quality-checked",
        trust1: "guaranteed turnaround", trust2: "languages covered",
        trust3: "human quality-checked", trust4: "Swiss conventions & data privacy",
        servicesTitle: "One service, four things it's great at",
        servicesLead: "Swiss employers, landlords and authorities expect polished, correctly formatted documents. We produce them for you — fast.",
        svc1Title: "Job application package",
        svc1Text: "Tailored CV plus a motivation letter written specifically for the posting you're applying to. Swiss format, correct tone, no generic filler.",
        svc1Price: "from CHF 80",
        svc2Title: "Executive dossier",
        svc2Text: "Senior and executive-level applications with achievement-focused positioning, leadership narrative and an extended review cycle.",
        svc2Price: "from CHF 250",
        svc3Title: "Rental application dossier",
        svc3Text: "Stand out in the Zurich and Geneva housing market: a complete, well-presented tenant dossier with a personal introduction letter.",
        svc3Price: "from CHF 120",
        svc4Title: "Official letters &amp; complaints",
        svc4Text: "Complaint letters, appeals, correspondence with insurers, landlords and authorities — firm, correct and in the right register.",
        svc4Price: "from CHF 60",
        howTitle: "How it works",
        how1Title: "You send",
        how1Text: "Upload your current CV and the job posting (or describe your letter). Add anything we should know — takes 5 minutes.",
        how2Title: "We draft &amp; refine",
        how2Text: "AI drafts a first version tailored to the posting. A human editor then personalises it, checks every fact and polishes the language.",
        how3Title: "You receive",
        how3Text: "Within 48 hours you get your finished package as PDF and editable files, with one free revision round included.",
        qualityTitle: "Nothing leaves us unread.",
        qualityText: "AI makes us fast; a human editor makes it right. Every document is reviewed line by line before delivery — dates, names, claims and tone.",
        pricingTitle: "Clear, fixed prices",
        pricingLead: "No hourly billing, no surprises. You know the price before you order.",
        price1Title: "Standard", price1Desc: "One tailored application in one language.",
        price1a: "CV tailored to the posting", price1b: "Motivation letter",
        price1c: "48h delivery", price1d: "1 revision round", priceCta: "Order",
        priceFlag: "Most popular",
        price2Title: "Bilingual", price2Desc: "The full package in two languages — e.g. German and English.",
        price2a: "Everything in Standard", price2b: "Second-language version of CV &amp; letter",
        price2c: "Consistent terminology across both", price2d: "2 revision rounds", priceCta2: "Order",
        price3Title: "Executive", price3Desc: "Senior-level dossiers with strategic positioning.",
        price3a: "30-min intake call", price3b: "Achievement-focused CV &amp; letter",
        price3c: "LinkedIn summary included", price3d: "Unlimited revisions for 14 days", priceCta3: "Order",
        pricingFootnote: "Rental dossier CHF 120 · Official letter or complaint from CHF 60 · Express 24h delivery +CHF 50",
        orderTitle: "Start your order",
        orderLead: "Five minutes now — a finished dossier within 48 hours.",
        wiz1: "Service", wiz2: "Documents", wiz3: "Options", wiz4: "Review",
        step1Legend: "What do you need?",
        optStandard: "Job application — Standard",
        optBilingual: "Job application — Bilingual",
        optExecutive: "Executive dossier",
        optRental: "Rental application dossier",
        optLetter: "Official letter / complaint",
        step2Legend: "Your documents",
        labelCv: "Current CV (PDF or Word)",
        hintCv: "Don't have one? Leave empty and describe your background below.",
        labelPosting: "Job posting — paste a link or the full text",
        phPosting: "https://... or paste the posting text here. For letters: describe your situation and what you want to achieve.",
        labelNotes: "Anything we should know? (optional)",
        phNotes: "Career change, employment gap, salary expectations, preferred emphasis...",
        step3Legend: "Options",
        labelLang: "Document language", labelLang2: "Second language",
        langDe: "German", langEn: "English", langFr: "French", langIt: "Italian",
        labelExpress: "Express delivery within 24 hours (+CHF 50)",
        step4Legend: "Review &amp; contact",
        labelEmail: "Your email — we deliver your dossier here",
        phEmail: "name@example.ch",
        summaryTitle: "Order summary", summaryTotal: "Total",
        summaryPay: "Payment by TWINT or invoice after you confirm — you pay only when you're satisfied with the first draft.",
        successTitle: "Order received — the 48h clock is ticking",
        successText: "You'd now receive a confirmation email with your delivery time. In this prototype, nothing was actually sent or stored.",
        successRestart: "Start another order",
        btnBack: "Back", btnNext: "Next", btnSubmit: "Place order",
        runningTotal: "Current total:",
        sumService: "Service", sumLanguage: "Language", sumLanguages: "Languages",
        sumDelivery: "Delivery", sumStandard48: "within 48 hours", sumExpress24: "Express, within 24 hours",
        testiTitle: "What clients say",
        testiNote: "Illustrative examples for this prototype — not real testimonials.",
        testi1: "“Three applications, two interviews. The letters actually sounded like me — just better.”",
        testi1By: "M., Project manager, Zurich",
        testi2: "“We got the flat. Out of 40 applicants. The dossier made the difference.”",
        testi2By: "L. & T., Geneva",
        testi3: "“My German CV was fine — my English one wasn't. Now both open doors.”",
        testi3By: "S., Software engineer, Basel",
        faqTitle: "Frequently asked questions",
        faq1Q: "Is this written by AI?",
        faq1A: "AI produces the first draft — that's how we can be fast and affordable. A human editor then personalises, fact-checks and polishes every document. Nothing is delivered without human review, and we never invent qualifications or experience.",
        faq2Q: "What happens to my data?",
        faq2A: "Your documents are used only to produce your dossier and are deleted after 30 days unless you ask us to keep them for future applications. We never share them with third parties.",
        faq3Q: "What if I don't like the result?",
        faq3A: "Every package includes at least one revision round. You only pay once you're satisfied with the first draft — if we can't get it right, you owe nothing.",
        faq4Q: "Can you really deliver in 48 hours?",
        faq4A: "Yes — 48 hours from the moment we have your CV and the posting, on business days. Need it faster? Express delivery in 24 hours is available for +CHF 50.",
        faq5Q: "Do you also do French and Italian?",
        faq5A: "Yes. We cover German, French, Italian and English, including bilingual packages with consistent terminology across both versions.",
        finalTitle: "The next application you send could be the one.",
        finalText: "Make it your strongest. Your tailored dossier, delivered within 48 hours.",
        finalCta: "Start your order — from CHF 80",
        footerTag: "Swiss application & document service",
        footerNote: "Prototype landing page — a business-idea demo, not a live service."
    },
    de: {
        protoBanner: "Prototyp — es werden keine echten Bestellungen ausgelöst und keine Daten verlassen Ihren Browser.",
        navServices: "Angebot", navHow: "So funktioniert's", navPricing: "Preise", navFaq: "FAQ",
        navCta: "Jetzt bestellen",
        heroEyebrow: "Zürich · Genf · die ganze Schweiz",
        heroTitle: "Ihr Schweizer Bewerbungsdossier. Massgeschneidert, in 48&nbsp;Stunden.",
        heroLead: "Senden Sie uns Ihren Lebenslauf und die Stellenanzeige. Sie erhalten ein vollständiges, massgeschneidertes Bewerbungspaket — CV, Motivationsschreiben, auf Wunsch in einer zweiten Sprache — versandfertig innert 48 Stunden.",
        heroCta1: "Jetzt bestellen", heroCta2: "So funktioniert's",
        heroPoint1: "KI-Entwurf, immer von Menschen finalisiert",
        heroPoint2: "Deutsch, Französisch, Italienisch &amp; Englisch",
        heroPoint3: "Fixpreise ab CHF 80",
        docTitle: "Motivationsschreiben", docCheck: "✓ Von Hand geprüft",
        trust1: "garantierte Lieferzeit", trust2: "Sprachen abgedeckt",
        trust3: "von Menschen geprüft", trust4: "Schweizer Standards & Datenschutz",
        servicesTitle: "Ein Service, vier Stärken",
        servicesLead: "Schweizer Arbeitgeber, Vermieter und Behörden erwarten gepflegte, korrekt formatierte Unterlagen. Wir erstellen sie für Sie — schnell.",
        svc1Title: "Bewerbungspaket",
        svc1Text: "Massgeschneiderter Lebenslauf plus ein Motivationsschreiben, das gezielt auf die Stelle eingeht. Schweizer Format, richtiger Ton, keine Floskeln.",
        svc1Price: "ab CHF 80",
        svc2Title: "Executive-Dossier",
        svc2Text: "Bewerbungen für Kader- und Führungspositionen mit erfolgsorientierter Positionierung, Leadership-Narrativ und erweitertem Review.",
        svc2Price: "ab CHF 250",
        svc3Title: "Mietbewerbungsdossier",
        svc3Text: "Heben Sie sich im Wohnungsmarkt von Zürich und Genf ab: ein vollständiges, überzeugendes Mieterdossier mit persönlichem Begleitschreiben.",
        svc3Price: "ab CHF 120",
        svc4Title: "Amtliche Briefe &amp; Beschwerden",
        svc4Text: "Beschwerdebriefe, Einsprachen, Korrespondenz mit Versicherungen, Vermietern und Behörden — bestimmt, korrekt und im richtigen Register.",
        svc4Price: "ab CHF 60",
        howTitle: "So funktioniert's",
        how1Title: "Sie senden",
        how1Text: "Laden Sie Ihren aktuellen Lebenslauf und die Stellenanzeige hoch (oder beschreiben Sie Ihren Brief). Dauert 5 Minuten.",
        how2Title: "Wir entwerfen &amp; verfeinern",
        how2Text: "KI erstellt einen ersten, auf die Stelle zugeschnittenen Entwurf. Danach personalisiert ein Lektor den Text, prüft jede Angabe und schleift die Sprache.",
        how3Title: "Sie erhalten",
        how3Text: "Innert 48 Stunden erhalten Sie Ihr fertiges Paket als PDF und editierbare Dateien — inklusive einer kostenlosen Korrekturrunde.",
        qualityTitle: "Nichts verlässt uns ungelesen.",
        qualityText: "KI macht uns schnell; ein menschlicher Lektor macht es richtig. Jedes Dokument wird vor der Lieferung Zeile für Zeile geprüft — Daten, Namen, Aussagen und Ton.",
        pricingTitle: "Klare Fixpreise",
        pricingLead: "Keine Stundenabrechnung, keine Überraschungen. Sie kennen den Preis vor der Bestellung.",
        price1Title: "Standard", price1Desc: "Eine massgeschneiderte Bewerbung in einer Sprache.",
        price1a: "CV auf die Stelle zugeschnitten", price1b: "Motivationsschreiben",
        price1c: "Lieferung in 48h", price1d: "1 Korrekturrunde", priceCta: "Bestellen",
        priceFlag: "Am beliebtesten",
        price2Title: "Zweisprachig", price2Desc: "Das komplette Paket in zwei Sprachen — z.B. Deutsch und Englisch.",
        price2a: "Alles aus Standard", price2b: "CV &amp; Brief in zweiter Sprache",
        price2c: "Konsistente Terminologie in beiden", price2d: "2 Korrekturrunden", priceCta2: "Bestellen",
        price3Title: "Executive", price3Desc: "Dossiers für Kaderpositionen mit strategischer Positionierung.",
        price3a: "30-Min-Erstgespräch", price3b: "Erfolgsorientierter CV &amp; Brief",
        price3c: "LinkedIn-Profiltext inklusive", price3d: "Unbegrenzte Revisionen für 14 Tage", priceCta3: "Bestellen",
        pricingFootnote: "Mietdossier CHF 120 · Amtlicher Brief oder Beschwerde ab CHF 60 · Express-Lieferung in 24h +CHF 50",
        orderTitle: "Jetzt bestellen",
        orderLead: "Fünf Minuten jetzt — ein fertiges Dossier innert 48 Stunden.",
        wiz1: "Service", wiz2: "Unterlagen", wiz3: "Optionen", wiz4: "Prüfen",
        step1Legend: "Was brauchen Sie?",
        optStandard: "Bewerbung — Standard",
        optBilingual: "Bewerbung — Zweisprachig",
        optExecutive: "Executive-Dossier",
        optRental: "Mietbewerbungsdossier",
        optLetter: "Amtlicher Brief / Beschwerde",
        step2Legend: "Ihre Unterlagen",
        labelCv: "Aktueller Lebenslauf (PDF oder Word)",
        hintCv: "Noch keinen? Leer lassen und Ihren Hintergrund unten beschreiben.",
        labelPosting: "Stellenanzeige — Link oder vollständigen Text einfügen",
        phPosting: "https://... oder den Text der Anzeige hier einfügen. Für Briefe: Beschreiben Sie Ihre Situation und Ihr Ziel.",
        labelNotes: "Gibt es etwas zu beachten? (optional)",
        phNotes: "Berufswechsel, Lücke im Lebenslauf, Lohnvorstellungen, gewünschte Schwerpunkte...",
        step3Legend: "Optionen",
        labelLang: "Sprache der Dokumente", labelLang2: "Zweite Sprache",
        langDe: "Deutsch", langEn: "Englisch", langFr: "Französisch", langIt: "Italienisch",
        labelExpress: "Express-Lieferung innert 24 Stunden (+CHF 50)",
        step4Legend: "Prüfen &amp; Kontakt",
        labelEmail: "Ihre E-Mail — hierhin liefern wir Ihr Dossier",
        phEmail: "name@beispiel.ch",
        summaryTitle: "Bestellübersicht", summaryTotal: "Total",
        summaryPay: "Zahlung per TWINT oder Rechnung nach Ihrer Bestätigung — Sie zahlen erst, wenn Sie mit dem ersten Entwurf zufrieden sind.",
        successTitle: "Bestellung erhalten — die 48h laufen",
        successText: "Sie würden jetzt eine Bestätigungs-E-Mail mit Ihrem Liefertermin erhalten. In diesem Prototyp wurde nichts gesendet oder gespeichert.",
        successRestart: "Weitere Bestellung starten",
        btnBack: "Zurück", btnNext: "Weiter", btnSubmit: "Bestellen",
        runningTotal: "Aktuelles Total:",
        sumService: "Service", sumLanguage: "Sprache", sumLanguages: "Sprachen",
        sumDelivery: "Lieferung", sumStandard48: "innert 48 Stunden", sumExpress24: "Express, innert 24 Stunden",
        testiTitle: "Das sagen Kundinnen und Kunden",
        testiNote: "Illustrative Beispiele für diesen Prototyp — keine echten Kundenstimmen.",
        testi1: "«Drei Bewerbungen, zwei Vorstellungsgespräche. Die Briefe klangen wirklich nach mir — nur besser.»",
        testi1By: "M., Projektleiter, Zürich",
        testi2: "«Wir haben die Wohnung bekommen. Bei 40 Bewerbungen. Das Dossier hat den Unterschied gemacht.»",
        testi2By: "L. & T., Genf",
        testi3: "«Mein deutscher CV war gut — mein englischer nicht. Jetzt öffnen beide Türen.»",
        testi3By: "S., Software-Ingenieurin, Basel",
        faqTitle: "Häufige Fragen",
        faq1Q: "Schreibt das eine KI?",
        faq1A: "Die KI liefert den ersten Entwurf — deshalb sind wir schnell und bezahlbar. Danach personalisiert ein menschlicher Lektor jedes Dokument, prüft die Fakten und poliert die Sprache. Nichts wird ohne menschliche Prüfung geliefert, und wir erfinden nie Qualifikationen oder Erfahrungen.",
        faq2Q: "Was geschieht mit meinen Daten?",
        faq2A: "Ihre Unterlagen werden nur für Ihr Dossier verwendet und nach 30 Tagen gelöscht — ausser Sie möchten, dass wir sie für künftige Bewerbungen behalten. Wir geben sie nie an Dritte weiter.",
        faq3Q: "Was, wenn mir das Resultat nicht gefällt?",
        faq3A: "Jedes Paket enthält mindestens eine Korrekturrunde. Sie zahlen erst, wenn Sie mit dem ersten Entwurf zufrieden sind — wenn wir es nicht hinbekommen, schulden Sie nichts.",
        faq4Q: "Schaffen Sie wirklich 48 Stunden?",
        faq4A: "Ja — 48 Stunden ab dem Moment, in dem wir Ihren CV und die Anzeige haben, an Werktagen. Noch schneller? Express-Lieferung in 24 Stunden für +CHF 50.",
        faq5Q: "Auch Französisch und Italienisch?",
        faq5A: "Ja. Wir arbeiten auf Deutsch, Französisch, Italienisch und Englisch — inklusive zweisprachiger Pakete mit konsistenter Terminologie in beiden Versionen.",
        finalTitle: "Die nächste Bewerbung könnte die richtige sein.",
        finalText: "Machen Sie sie zu Ihrer stärksten. Ihr massgeschneidertes Dossier, geliefert innert 48 Stunden.",
        finalCta: "Jetzt bestellen — ab CHF 80",
        footerTag: "Schweizer Bewerbungs- & Dokumentenservice",
        footerNote: "Prototyp einer Landingpage — Demo einer Geschäftsidee, kein aktiver Service."
    }
};

let currentLang = "en";

function t(key) {
    return I18N[currentLang][key] ?? I18N.en[key] ?? key;
}

function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        if (I18N[lang][key] !== undefined) el.innerHTML = I18N[lang][key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll(".lang-toggle button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });
    updateWizardChrome();
    updatePrice();
}

/* ---------- Order wizard ---------- */

const form = document.getElementById("order-form");
const panes = [...form.querySelectorAll(".wizard-pane")];
const stepDots = [...document.querySelectorAll(".wizard-steps li")];
const backBtn = document.getElementById("back-btn");
const nextBtn = document.getElementById("next-btn");
const wizardNav = form.querySelector(".wizard-nav");
const secondLangField = document.getElementById("second-lang-field");
const LAST_STEP = 4;
let step = 1;

function selectedService() {
    return form.querySelector("input[name=service]:checked").value;
}

function currentTotal() {
    let total = PRICES[selectedService()];
    if (document.getElementById("express").checked) total += EXPRESS_SURCHARGE;
    return total;
}

function updatePrice() {
    const label = "CHF " + currentTotal();
    document.getElementById("running-price").textContent = label;
    document.getElementById("summary-price").textContent = label;
}

function serviceLabel() {
    const key = {
        standard: "optStandard", bilingual: "optBilingual",
        executive: "optExecutive", rental: "optRental", letter: "optLetter"
    }[selectedService()];
    return t(key);
}

function langLabel(selectEl) {
    return t({ de: "langDe", en: "langEn", fr: "langFr", it: "langIt" }[selectEl.value]);
}

function buildSummary() {
    const bilingual = selectedService() === "bilingual";
    const lang1 = langLabel(document.getElementById("doc-lang"));
    const langValue = bilingual
        ? lang1 + " + " + langLabel(document.getElementById("doc-lang-2"))
        : lang1;
    const express = document.getElementById("express").checked;
    const rows = [
        [t("sumService"), serviceLabel()],
        [bilingual ? t("sumLanguages") : t("sumLanguage"), langValue],
        [t("sumDelivery"), express ? t("sumExpress24") : t("sumStandard48")]
    ];
    document.getElementById("summary-list").innerHTML =
        rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

function updateWizardChrome() {
    panes.forEach(p => p.classList.toggle("active", Number(p.dataset.step) === step));
    stepDots.forEach((dot, i) => {
        dot.classList.toggle("active", i + 1 === step);
        dot.classList.toggle("done", i + 1 < step);
    });
    const done = step > LAST_STEP;
    wizardNav.hidden = done;
    if (done) return;
    backBtn.hidden = step === 1;
    nextBtn.innerHTML = step === LAST_STEP ? t("btnSubmit") : t("btnNext");
    secondLangField.hidden = selectedService() !== "bilingual";
    if (step === LAST_STEP) buildSummary();
}

nextBtn.addEventListener("click", () => {
    if (step === LAST_STEP) {
        const email = document.getElementById("email");
        if (!email.value || !email.checkValidity()) {
            email.classList.add("field-error");
            email.focus();
            return;
        }
        email.classList.remove("field-error");
    }
    step += 1;
    updateWizardChrome();
    if (step > LAST_STEP) document.getElementById("order").scrollIntoView();
});

backBtn.addEventListener("click", () => {
    step = Math.max(1, step - 1);
    updateWizardChrome();
});

document.getElementById("restart-btn").addEventListener("click", () => {
    form.reset();
    step = 1;
    updateWizardChrome();
    updatePrice();
});

document.getElementById("email").addEventListener("input", e => {
    e.target.classList.remove("field-error");
});

form.addEventListener("change", () => {
    updatePrice();
    secondLangField.hidden = selectedService() !== "bilingual";
});

// Pricing-card "Order" buttons preselect the matching service.
document.querySelectorAll("[data-order-service]").forEach(btn => {
    btn.addEventListener("click", () => {
        const input = form.querySelector(`input[name=service][value=${btn.dataset.orderService}]`);
        if (input) input.checked = true;
        step = 1;
        updateWizardChrome();
        updatePrice();
    });
});

document.querySelectorAll(".lang-toggle button").forEach(btn => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
});

updateWizardChrome();
updatePrice();
