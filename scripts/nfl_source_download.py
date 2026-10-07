"""Follow the public download form for pinned Logowik vector sources."""
import html
import http.cookiejar
import re
import urllib.parse
import urllib.request

from download_svgs import USER_AGENT


def fetch_logowik_svg(url):
    if urllib.parse.urlsplit(url).netloc != 'logowik.com':
        raise ValueError('expected a Logowik source page')
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(target, data=None):
        req = urllib.request.Request(target, data=data, headers={
            'User-Agent': USER_AGENT, 'Referer': url})
        with opener.open(req, timeout=45) as response:
            return response.read()

    page = request(url).decode('utf-8')
    tokens = re.findall(r'<input\b[^>]*name="_token"[^>]*value="([^"]+)"', page)
    if len(tokens) != 1:
        raise ValueError('download form changed; review the public source page')
    # Use the site's normal guest workflow, including its session cookies.
    page = request(url, urllib.parse.urlencode({'_token': html.unescape(tokens[0])}).encode()).decode('utf-8')
    links = [html.unescape(href) for href, body in re.findall(
        r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S)
        if 'download/svg/svg.svg' in body]
    if len(links) != 1 or not links[0].startswith('https://logowik.com/down?file='):
        raise ValueError('SVG download unavailable; review the public source page')
    return request(links[0])
