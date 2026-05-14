(function () {
    const script = document.currentScript;
    const scriptUrl = new URL(script.src, document.baseURI);
    const base = new URL('..', scriptUrl).href;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('header.css', scriptUrl).href;
    document.head.appendChild(link);

    fetch(new URL('header.html', scriptUrl).href)
        .then(r => r.text())
        .then(html => {
            html = html.split('{BASE}').join(base);
            const target = document.getElementById('site-header');
            if (target) {
                target.innerHTML = html;
            } else {
                document.body.insertAdjacentHTML('afterbegin', html);
            }
            const here = window.location.href.split('#')[0].split('?')[0];
            document.querySelectorAll('.navbar-nav a.nav-link').forEach(a => {
                if (a.href.split('#')[0].split('?')[0] === here) {
                    a.classList.add('active');
                    a.setAttribute('aria-current', 'page');
                }
            });
        });
})();
