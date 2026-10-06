import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchArticle, isBrokenApod, parseArticle} from '../nasa_apod@elinvention.ovh/utils/apod.js';

const html = `<meta content="https://assets.science.nasa.gov/rainbow.jpg/jcr:content/renditions/cq5dam.web.1280.1280.jpeg" property="og:image">
<h1>Rainbows &amp; stars &#8211; tonight</h1>
<p class="p-md media-detail-hero__description"><strong>Explanation: </strong>A <a href="/">rainbow</a>.<br>More stars.</p>
<th scope="row">Credit &amp; Copyright</th><td><a href="/">Jane Doe</a></td>`;

test('rejects NASA placeholders while preserving pictures and videos', () => {
    assert.equal(isBrokenApod({media_type: 'image', url: 'https://example.org/nasa-logo@2x.png'}), true);
    assert.equal(isBrokenApod({title: 'NASA Science', media_type: 'image', url: 'https://example.org/photo.jpg'}), true);
    assert.equal(isBrokenApod({media_type: 'image', url: 'https://science.nasa.gov/image-article/example/'}), true);
    assert.equal(isBrokenApod({media_type: 'image', url: 'https://example.org/photo.jpg?width=1280'}), false);
    assert.equal(isBrokenApod({media_type: 'video', url: 'https://youtube.com/embed/example'}), false);
});

test('extracts complete article metadata and original resolution', () => {
    const data = parseArticle(html, '2026-10-04');
    assert.equal(data.title, 'Rainbows & stars – tonight');
    assert.equal(data.explanation, 'A rainbow. More stars.');
    assert.equal(data.copyright, 'Jane Doe');
    assert.equal(data.hdurl, 'https://assets.science.nasa.gov/rainbow.jpg');
    assert.equal(data.date, '2026-10-04');
    assert.throws(() => parseArticle(html.replace('rainbow.jpg', 'nasa-logo.png'), data.date));
    assert.throws(() => parseArticle('<h1>NASA Science</h1>', data.date));
});

test('selects the exact date despite fuzzy search results', async () => {
    const request = async url => {
        if (url.includes('wp-json')) {
            return JSON.stringify([
                {slug: 'apod-2026-october-14-wrong', link: 'https://science.nasa.gov/wrong'},
                {slug: 'apod-2026-october-4-rainbows', link: 'https://science.nasa.gov/right'},
            ]);
        }
        assert.equal(url, 'https://science.nasa.gov/right');
        return html;
    };
    assert.equal((await fetchArticle(request, '2026-10-04')).date, '2026-10-04');
});

test('tries yesterday only when permitted and never changes a pinned date', async () => {
    const request = async url => {
        if (url.includes('apod-2026-january-1'))
            return '[]';
        if (url.includes('apod-2025-december-31'))
            return JSON.stringify([{slug: 'apod-2025-december-31-stars', link: 'https://science.nasa.gov/stars'}]);
        return html;
    };
    assert.equal((await fetchArticle(request, '2026-01-01', true)).date, '2025-12-31');
    await assert.rejects(fetchArticle(request, '2026-01-01'), /No APOD article/);
    await assert.rejects(fetchArticle(async () => '[]', '2026-01-01', true), /2025-12-31/);
});
