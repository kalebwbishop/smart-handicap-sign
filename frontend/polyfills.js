// Polyfills: some libraries (axios, react-router-dom, react-secure-storage,
// socket.io-client, etc.) read browser globals at import time, which are
// undefined in React Native before the runtime is ready.

if (typeof window !== 'undefined') {
    if (!window.location) {
        window.location = {
            hostname: '',
            protocol: 'https:',
            port: '',
            href: '',
            origin: '',
            pathname: '/',
            search: '',
            hash: '',
            assign() {},
            replace() {},
            reload() {},
        };
    }
    if (!window.screen) {
        window.screen = { colorDepth: 24, pixelDepth: 24, width: 0, height: 0 };
    }
    if (!window.navigator) {
        window.navigator = { userAgent: '', languages: [], language: 'en' };
    } else {
        if (!window.navigator.userAgent) window.navigator.userAgent = '';
        if (!window.navigator.languages) window.navigator.languages = [];
    }
    if (!window.history) {
        window.history = {
            length: 0,
            state: null,
            pushState() {},
            replaceState() {},
            go() {},
            back() {},
            forward() {},
        };
    }
}

if (typeof document !== 'undefined') {
    if (!document.cookie) {
        Object.defineProperty(document, 'cookie', {
            get() { return ''; },
            set() {},
            configurable: true,
        });
    }
    if (!document.styleSheets) {
        document.styleSheets = [];
    }
    if (!document.querySelector) {
        document.querySelector = () => null;
        document.querySelectorAll = () => [];
    }
}
