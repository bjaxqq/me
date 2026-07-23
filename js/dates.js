export function parseDate(value) {
    if (value instanceof Date) return value;

    if (!value) return new Date(NaN);

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        const [y, m, d] = value.trim().split('-').map(Number);

        return new Date(y, m - 1, d);
    }
    
    return new Date(value);
}

const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export function longDate(value) {
    const d = parseDate(value);

    return valid(d) ? d.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    }) : '';
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function shortDate(value) {
    const d = parseDate(value);

    if (!valid(d)) return '';
    
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

export function monthYear(value) {
    const d = parseDate(value);
    
    return valid(d) ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function year(value) {
    const d = parseDate(value);
    
    return valid(d) ? d.getFullYear() : null;
}
