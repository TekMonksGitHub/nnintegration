const fs = require('fs');
const path = require('path');
const { request } = require('undici');
const puppeteer = require('puppeteer');
const { Parser } = require('htmlparser2');

async function fetchWithCookies(url, cookieHeader, headers = {}) {
      return await request(url, {
            method: 'GET', headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; WebScraper/1.0)',
                  'Accept': '*/*', 'Cookie': cookieHeader || '', ...headers,
            }
      });
}

async function getCookiesViaLogin(loginUrl, loginConfig, cookieSavePath) {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();

      await page.goto(loginUrl, { waitUntil: 'networkidle2' });

      await page.type(loginConfig.usernameSelector, loginConfig.username);
      await page.type(loginConfig.passwordSelector, loginConfig.password);
      await page.click(loginConfig.submitSelector);

      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      const cookies = await page.cookies();
      fs.writeFileSync(cookieSavePath, JSON.stringify(cookies, null, 2));
      await browser.close();
      return buildCookieHeader(cookies);
}

module.exports = async ({ url, config }) => {
      const output = { url, mimeType: null, links: [], savedFile: null, error: null };

      try {
            let cookieHeader; if (config.protected) {
                  const domain = new URL(url).hostname;
                  const cookieFile = path.join(__dirname, 'cookies', `${domain}.txt`);
                  cookieHeader = JSON.parse(fs.existsSync(cookieFile) ? fs.readFileSync(cookieFile, 'utf-8').trim() : null);
                  cookieHeader = buildCookieHeader(cookieHeader)
                  if (!cookieHeader) cookieHeader = await getCookiesViaLogin(url, config.loginConfig, cookieFile);
            } response = await fetchWithCookies(url, cookieHeader);

            if (response.statusCode >= 400) {
                  output.error = `HTTP error: ${response.statusCode}`;
                  return output;
            }

            const mimeType = response.headers['content-type']?.split(';')[0].trim() || '';
            output.mimeType = mimeType;

            if (!config.mimeTypes.includes(mimeType)) {
                  output.error = `MIME not allowed: ${mimeType}`;
                  return output;
            }

            const chunks = [];
            for await (const chunk of response.body) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            const ext = mimeType.includes('html') ? 'html' :
                  mimeType.includes('pdf') ? 'pdf' :
                        mimeType.includes('msword') ? 'doc' : 'bin';

            if (config.downloadFiles) {
                  const savedfilePath = path.join(config.outputFolder, `${url.replaceAll("/", "_")}.${ext}`);
                  fs.writeFileSync(savedfilePath, buffer);
                  output.savedFile = savedfilePath;
            } else {
                  const urlLogFilePath = config.urlLogFilePath;
                  if (!fs.existsSync(urlLogFilePath)) fs.writeFileSync(urlLogFilePath, "")
                  fs.appendFileSync(urlLogFilePath, url + "\n");
                  output.savedFile = urlLogFilePath;
            }

            if (mimeType === "text/html") {
                  const html = buffer.toString();
                  const links = [];

                  const parser = new Parser({
                        onopentag(name, attribs) {
                              if (name === 'a' && attribs.href) links.push(attribs.href);
                        }
                  });

                  parser.write(html);
                  parser.end();
                  output.links = [...new Set(links)];
            }

            return output;
      } catch (err) {
            output.error = `Body is unusable: ${err.message}`;
            return output;
      }
};

function buildCookieHeader(cookieArray) {
      if (!Array.isArray(cookieArray)) return undefined;
      return cookieArray.map(({ name, value }) => `${name}=${value}`).join('; ');
}