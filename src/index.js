
const request = require('request-promise-native')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const sqlite = require('sqlite')
const Td = require('turndown')
const winston = require('winston')

const constants = {
  regexps: {
    article: /\/slatestarcodex.com\/2[0-9]{3}\/[0-9]+\/[0-9]+/i
  },
  selectors: {
    link: '#pjgm-content a',
    title: '.pjgm-posttitle',
    date: 'span.entry-date',
    rawContent: 'div.pjgm-postcontent'
  },
  urls: {
    slateStarCodex: 'http://slatestarcodex.com/archives/'
  },
  queries: { },
  paths: {
    database: './data/content.sqlite'
  }
}

constants.queries.getByUrl = 'SELECT * FROM Content WHERE url = ?'
constants.queries.createTable = `CREATE TABLE IF NOT EXISTS Content (
  url TEXT PRIMARY KEY,
  content BLOB NOT NULL
)`

constants.queries.insertContent = 'INSERT INTO Content (url, content) VALUES ($url, $content)'

const retrieveLinks = async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(constants.urls.slateStarCodex)

  const links = await page.$$eval(constants.selectors.link, hrefs => {
    return hrefs.map(a => a.href)
  })

  await browser.close();

  const kept = links.filter(link => {
    return constants.regexps.article.test(link)
  })

  winston.info(`Retrieved ${links.length} links from ${constants.urls.slateStarCodex}; storing ${kept.length} of them.`)

  return kept
}

const labelExisting = async links => {
  const db = await sqlite.open(constants.paths.database)

  const results = []
  winston.info(`determining which posts are stored locally.`)

  for (let link of links) {
    try {
      const content = await db.get(constants.queries.getByUrl, link)
      results.push({
        exists: typeof content !== 'undefined',
        link,
        err: null
      })
    } catch (err) {
      results.push({err, link})
    }
  }

  winston.info(`finished determining which posts are stored locally (${results.filter(link => link.exists).length} of ${results.length})`)

  return results
}

const downloadArticle = async link => {
  try {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto(link)

    const content = {
      title: await page.$eval(constants.selectors.title, div => div.textContent),
      date: await page.$eval(constants.selectors.date, div => div.textContent)
    }

    const rawContent = await page.$eval(constants.selectors.rawContent, div => div.innerHTML)

    content.body = new Td().turndown(rawContent)
    await browser.close()

    return content

  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

const storeArticle = async (db, link, content) => {
  try {
    await db.run(constants.queries.insertContent, {
      $url: link,
      $content: JSON.stringify(content)
    })

  } catch (err) {
    console.log(err)
  }
}

const downloadMissingContent = async links => {
  const db = await sqlite.open(constants.paths.database)

  await db.all(constants.queries.createTable)
  const labeled = await labelExisting(links)
  let count = 0

  const required = labeled.filter(post => {
    return !post.exists
  })

  for (let {link} of required) {

    ++count
    winston.info(`downloading and storing ${link} (${count} of ${required.length})`)

    storeArticle(db, link, await downloadArticle(link))
  }
}

const main = async () => {
  const links = await retrieveLinks()
  const status = await downloadMissingContent(links)
}

main()
