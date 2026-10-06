'use strict';

const ARTICLE_API = 'https://science.nasa.gov/wp-json/wp/v2/image-article';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];

export function isBrokenApod(data) {
    return !data || typeof data !== 'object' || data.title === 'NASA Science' ||
        /nasa-logo/i.test(`${data.url} ${data.hdurl}`) ||
        (data.media_type === 'image' && !isImageUrl(data.url));
}

function isImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url) &&
        /\.(?:jpe?g|png|gif|webp|tiff?)(?:[?#]|$)/i.test(url);
}

function decodeHtml(text) {
    const entities = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—'};
    return text.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (match, code) => {
        const value = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
        return value <= 0x10ffff ? String.fromCodePoint(value) : match;
    }).replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function plainText(html) {
    return decodeHtml(html.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ''))
        .replace(/\s+/g, ' ').trim();
}

export function parseArticle(html, date) {
    const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const description = html.match(/<p\b[^>]*\bmedia-detail-hero__description\b[^>]*>([\s\S]*?)<\/p>/i);
    const credit = html.match(/<th\b[^>]*>\s*(?:Image\s+)?Credit[^<]*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i);
    let image;
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
        if (/\bproperty\s*=\s*["']og:image["']/i.test(tag)) {
            image = tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
            break;
        }
    }
    image = image ? decodeHtml(image) : '';
    if (!title || !description || !isImageUrl(image) || /nasa-logo/i.test(image))
        throw new Error(`No APOD picture and metadata found for ${date}`);

    return {
        date,
        media_type: 'image',
        title: plainText(title[1]),
        explanation: plainText(description[1]).replace(/^Explanation:\s*/i, ''),
        ...(credit ? {copyright: plainText(credit[1])} : {}),
        url: image,
        hdurl: image.replace(/\/jcr:content\/renditions\/.*$/, ''),
    };
}

export async function fetchArticle(request, date, allowPreviousDay = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new Error('Invalid APOD date');
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date)
        throw new Error('Invalid APOD date');
    const prefix = `apod-${year}-${MONTHS[month - 1]}-${day}-`;
    const articles = JSON.parse(await request(`${ARTICLE_API}?search=${prefix.slice(0, -1)}&_fields=slug,link,title`));
    const article = articles.find(item => item.slug.startsWith(prefix));
    if (!article) {
        if (allowPreviousDay) {
            const previous = new Date(`${date}T12:00:00Z`);
            previous.setUTCDate(previous.getUTCDate() - 1);
            return fetchArticle(request, previous.toISOString().slice(0, 10));
        }
        throw new Error(`No APOD article found for ${date}`);
    }
    if (!article.link.startsWith('https://science.nasa.gov/'))
        throw new Error('Invalid APOD article URL');
    return parseArticle(await request(article.link), date);
}
