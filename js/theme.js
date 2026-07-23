const KEY = 'edition';

const meta = () => document.querySelector('meta[name="theme-color"]:not([media])');

function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function currentTheme() {
    const set = document.documentElement.getAttribute('data-theme');
    
    if (set === 'light' || set === 'dark') return set;
    
    return systemPrefersDark() ? 'dark' : 'light';
}

export function applyTheme(theme) {
    const root = document.documentElement;

    if (theme === 'light' || theme === 'dark') {
        root.setAttribute('data-theme', theme);
    
        try { localStorage.setItem(KEY, theme); } catch {  }
    } else {
        root.removeAttribute('data-theme');
    
        try { localStorage.removeItem(KEY); } catch {  }
    }

    const tag = meta();
    
    if (tag) tag.setAttribute('content', currentTheme() === 'dark' ? '#14110f' : '#f4f1ea');

    document.querySelectorAll('[data-theme-toggle]').forEach(sync);
}

function sync(button) {
    const now = currentTheme();
    const next = now === 'dark' ? 'light' : 'dark';
    
    button.textContent = next === 'dark' ? 'Dark' : 'Light';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
    button.setAttribute('title', `Switch to ${next} mode`);
}

export function initTheme() {
    const buttons = document.querySelectorAll('[data-theme-toggle]');
    
    buttons.forEach((button) => {
        sync(button);
        button.addEventListener('click', () => {
            applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!document.documentElement.hasAttribute('data-theme')) {
            buttons.forEach(sync);
    
            const tag = meta();
    
            if (tag) tag.setAttribute('content', currentTheme() === 'dark' ? '#14110f' : '#f4f1ea');
        }
    });
}
