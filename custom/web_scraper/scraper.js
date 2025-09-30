const fs = require('fs');
const path = require('path');
const { Piscina } = require('piscina');
const utils = require(`${CONSTANTS.LIBDIR}/utils.js`);
const mimeMap = require(`${__dirname}/conf/mimeMap.json`);

let config, piscina; const visited = new Set(), pending = new Set();

exports.start = async function (routeName, _, _, message) {
	try {
		config = typeof (message.content) == 'object' ? message.content : JSON.parse(message.content);
		if (!config) return LOG.error("[Web Scraper] No config provided.");
		if (!_validateConfig(config)) return LOG.error("[Web Scraper] Invalid config provided, Missing important fields.");

		if(config.downloadFiles){
			config.outputFolder = utils.expandProperty(config.outputFolder);
			if (!fs.existsSync(config.outputFolder)) fs.mkdirSync(config.outputFolder, { recursive: true });
		} else config.urlLogFilePath = utils.expandProperty(config.urlLogFilePath);

		config.mimeTypes = config.fileTypes.map(type => mimeMap[type.toLowerCase()] || type);
		piscina = new Piscina({ filename: path.resolve(__dirname, 'worker.js'), maxThreads: config.concurrency });
		config.startUrls.forEach(url => {
			const norm = _normalizeUrl(url);
			pending.add(JSON.stringify({ url: norm, depth: 0, hostDepth: 0 }));
		});

		while (await runBatch()) LOG.info(`[Web Scraper] [QUEUE] Pending: ${pending.size} | Visited: ${visited.size}`);

		LOG.info(`[Web Scraper] ✅ Scraping complete. Total pages visited: ${visited.size}`);
	} catch (error) { LOG.error(`[Web Scraper] Error: ${error.message}`); }

	message.addRouteDone(routeName);
	message.setGCEligible(true);
}

function _normalizeUrl(url) {
	try {
		const u = new URL(url);
		u.hash = '';
		return u.href.replace(/\/+$/, '');
	} catch { return url; }
}

const runBatch = async () => {
	const tasks = [], chunk = Array.from(pending).splice(0, config.concurrency * 2);
	for (const entry of chunk) {
		pending.delete(entry);
		const task = JSON.parse(entry);
		tasks.push(processUrl(task));
	}

	await Promise.all(tasks);
	return pending.size > 0;
};

const processUrl = async ({ url, depth, hostDepth }) => {
	const normUrl = _normalizeUrl(url);
	if (config.maxPageDepth && depth > config.maxPageDepth) return; // skip if max depth mentioned & reached
	if (visited.has(normUrl)) return; // skip if already visited
	visited.add(normUrl); // mark as visited
	LOG.info(`[Web Scraper] Scraping: ${normUrl} (Depth: ${depth}, HostDepth: ${hostDepth})`);

	try {
		const result = await piscina.run({ url: normUrl, config, depth, hostDepth });

		if (result.error) { LOG.info(`[Web Scraper] Skipped ${normUrl}: ${result.error}`); return; }

		LOG.info(`[Web Scraper] ${config.downloadFiles ? "Saved" : "Added"}: ${normUrl} → ${result.savedFile} (${result.mimeType})`);

		const allowedPage = config.maxPageDepth ? depth < config.maxPageDepth : true;
		if (result.links.length > 0 && result.mimeType === 'text/html' && allowedPage) {
			const baseHost = new URL(normUrl).hostname;
			for (const link of result.links) {
				try {
					const newUrl = new URL(link, normUrl).href;
					const newHost = new URL(newUrl).hostname;
					const newHostDepth = (baseHost === newHost) ? hostDepth : hostDepth + 1;
					const finalUrl = _normalizeUrl(newUrl);

					const isAllowedHost = config.allowedDomains.find(domain => newHost.endsWith(domain));
					if ((newHostDepth <= config.maxHostDepth || isAllowedHost) && !visited.has(finalUrl)) {
						const queueItem = JSON.stringify({ url: finalUrl, depth: depth + 1, hostDepth: newHostDepth });
						if (!pending.has(queueItem)) {
							pending.add(queueItem);
							LOG.info(`[Web Scraper] Enqueued: ${finalUrl} (Depth: ${depth + 1}, HostDepth: ${newHostDepth})`);
						}
					}
				} catch (error) { LOG.info(`[Web Scraper] Bad link: ${link} (${error.message})`); }
			}
		}
	} catch (error) { LOG.error(`[Web Scraper] Failed ${normUrl}: ${error.message}`); }
};

const _validateConfig = (config) => config.startUrls && (config.maxHostDepth != undefined) && config.concurrency
	&& config.fileTypes && (config.downloadFiles ? config.outputFolder : config.urlLogFilePath);