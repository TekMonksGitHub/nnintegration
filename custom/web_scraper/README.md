# 🌐 Web Scraper

A powerful and flexible web scraper built with Node.js that can scrape any website. It supports file downloads, domain filtering, depth-limited crawling, and logging of visited URLs. It can also operate in URL logging mode without downloading content.

---

## 🚀 Features

- Crawl and scrape any website  
- Download files of specific types (\`html\`, \`pdf\`, \`doc\`, etc.)  
- Control crawl depth and domain boundaries  
- Concurrency control for faster scraping  
- Option to log URLs without downloading content  
- Easily configurable via a JSON file  

---

## 📦 Configuration

Create a configuration JSON file with the following structure:

```json
{
  "startUrls": ["http(s)://www.xyz.com"],                // Required: List of websites to be to crawled
  "concurrency": 5,                                      // Required: Number of concurrent scraping tasks
  "outputFolder": "{{{ESB_DIR}}}/xyzScrapedFiles",       // Required if downloadFiles = true: Folder to save downloaded files
  "maxPageDepth": 0,                                     // Optional: Max page depth for crawling (remove it if you don't want to impose any page depth limit)
  "maxHostDepth": 0,                                     // Required: Max depth allowed within the same host
  "allowedDomains": [ "another.com" ],               // Optional: Other allowed domains beyond the max host depth. Every domain that ends with the allowedDomains will be allowed
  "fileTypes": ["html", "pdf", "doc", "htm"],            // Required: Allowed url types to be dscraped
  "urlLogFilePath": "{{{ESB_DIR}}}/logs/urls.log",       // Required if downloadFiles = false: Path to store scraped URLs
  "downloadFiles": false,                                 // Required: Set to true to download files, false to only log URLs
  "protected": true,                                     // Optional: ture if site to be crawled is authentication protected
  "loginConfig": {                                       // Required if protected = true: login details
      "username": "test",
      "password": "edisiam",
      "usernameSelector":"#modlgn_username",
      "passwordSelector":"#modlgn_passwd",
      "submitSelector":"input[type='submit'][value='Login']"
  }
}
```

---

## 📂 mimeMap.json
This json holds the supported mime types and will scrap/download files with these mime types only. You can also add more mime types.

---

## 📂 Modes of Operation

### ✅ Download Mode
Set \`"donwloadFiles": true\` to download and save the allowed files (\`fileTypes\`) into the \`outputFolder\`.

### 📝 URL Logger Mode
Set \`"donwloadFiles": false\` to only log discovered URLs to \`urlLogFilePath\` without downloading content.

---

## 🛠️ Usage in ASB
A config is all that needed by the web_scraper. You can make your custom flows or use existing file listeners to feed a config to the web_scraper. Later on you can add another flow to listen the web_scraper generated outputFolder to ingest all the files present in that folder into the neuranet for ingestion along with the scraping.

### Sample Flow to use web_scraper
```json
{     
      "flow":{
            "name":"Web Scraper",
            "disabled":true,
            "expandRouteProperties": true
      },
      "listener": {
            "type":"file", 
            "isMessageGenerator": true,
            "path":"{{{ESB_DIR}}}/../testing/in/*.crawl",
            "donePath":"{{{ESB_DIR}}}/../testing/processing"
      },
      "route0":{
            "type": "filereader",
            "dependencies":["listener"],
            "donePath":"{{{ESB_DIR}}}/../testing/done",
            "encoding":"utf8"
      },
      "output": {
            "type":"js",
            "dependencies":["route0"],
            "module":"{{{ESB_DIR}}}/custom/web_scraper/scraper.js"
      }
}
```

### Sample Flow to ingest scraped files into Neuranet
Web Scraper has a ingest.js file that can be used to ingest all the downloding files into Neuranet.
```json
{
      "flow":{
          "name":"Ingest To Neuranet",
          "disabled":true,
          "expandRouteProperties": true
      },
      "listener": {
          "type":"file", 
          "isMessageGenerator": true,
          "path":"{{{ESB_DIR}}}/filesForIngestion/*",
          "donePath":"{{{ESB_DIR}}}/testing/processing"
      },
      "route0": {
          "type":"js",
          "dependencies":["listener"],
          "id": "tekmonks@deeplogictech.com",
          "org": "tekmonks",
          "aiappid": "tkmaiapp",
          "cmspath": "uploads",
          "module":"{{{ESB_DIR}}}/custom/web_scraper/ingest.js"
      },
      "output": {
          "type": "rest",
          "dependencies":["route0"],
          "host":"neuranet.app",
          "port":9090,
          "isSecure": true,
          "method":"post",
          "path": "/apps/neuranet/indexdoc",
          "timeout": 180000,
          "sslObj": {"rejectUnauthorized": false},
          "headers":["USER-AGENT: JSON_ESB", "ACCEPT: application/json", 
            "X-API-KEY: <your_x_api_key>"]
      }
}
```

---

## 📌 Requirements

- Node.js (v16+ recommended)  
- Internet access to target websites  
- undici (NPM)
- piscina (NPM)
- puppeteer (NPM)
- htmlparser2 (NPM)
---

## 💡 Tips

- Use lower concurrency for large websites to avoid IP bans.  
- Include \`allowedDomains\` if the site links to external domains you also want to crawl.  
- Adjust \`maxPageDepth\` and \`maxHostDepth\` based on your crawl scope needs.  
- Monitor logs regularly when crawling large or dynamic websites.  

---

