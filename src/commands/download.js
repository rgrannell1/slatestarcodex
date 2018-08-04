
const chalk = require('chalk')
const cheerio = require('cheerio')
const constants = require('../constants')
const pulp = require('@rgrannell/pulp')
const puppeteer = require('puppeteer')
const retryPromise = require('promise-retry')
const sqlite = require('sqlite')
const Td = require('turndown')

/**
 * Retrieve a list of articles from SlateStarCodex
 *
 * @param {EventEmitter} emitter the pulp event-emitter
 *
 * @return {Array<String>} a list of links.
 */
const retrieveLinks = async emitter => {
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

  emitter.emit(pulp.events.subTaskProgress, `Retrieved ${links.length} links from "${chalk.bold(constants.urls.slateStarCodex)}"; storing ${kept.length} of them.`)

  return kept
}

/**
 * Find links that are not stored in the local database.
 *
 * @param  {Array<string>} links an array of strings.
 * @param {EventEmitter} emitter the pulp event-emitter
 *
 * @return {Array<string>} a subset of links.
 */
const findMissingLinks = async (links, emitter) => {
  const db = await sqlite.open(constants.paths.database)

  const results = []

  emitter.emit(pulp.events.subTaskProgress, `determining which posts are stored locally.`)

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

  db.close()

  emitter.emit(pulp.events.subTaskProgress, `finished determining which posts are stored locally (${results.filter(link => link.exists).length} of ${results.length})`)

  return results
}

/**
 * Download an article as structured content.
 *
 * @param  {Object} browser a puppeteer browser instance.
 * @param  {string} link    a url to an article.
 *
 * @return {Object}         structured content extracted from a link.
 */
const downloadArticle = async (browser, link) => {
  try {
    const page = await browser.newPage()

    await retryPromise(retry => {
      return page.goto(link, {timeout: 60000}).catch(retry)
    })

    const rawContent = await page.$eval(constants.selectors.rawContent, div => div.innerHTML)
    const content = {
      title: await page.$eval(constants.selectors.title, div => div.textContent),
      date: await page.$eval(constants.selectors.date, div => div.textContent),
      body: new Td().turndown(rawContent)
    }

    await page.close()

    return content

  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

/**
 * Write an article to the local database.
 *
 * @param  {Object} db      the database client.
 * @param  {string} link    a URL to an article.
 * @param  {object} content structured content downloaded from the article
 *
 * @return {undefined}
 */
const storeArticle = async (db, link, content) => {
  try {
    await db.run(constants.queries.insertContent, {
      $url: link,
      $content: JSON.stringify(content)
    })

  } catch (err) {
    logger.error(`an error occurred while storing content: ${err.message}`)
  }
}

/**
 * Download articles that aren't stored in the local database.
 *
 * @param  {Array<String>} links URL's pointing to SlateStarCodex articles.
 * @param {EventEmitter} emitter the pulp event-emitter
 *
 */
const downloadMissingContent = async (links, emitter) => {
  const db = await sqlite.open(constants.paths.database)

  await db.all(constants.queries.createTable)
  const labeled = await findMissingLinks(links, emitter)
  let count = 0

  const required = labeled.filter(post => {
    return !post.exists
  })

  const browser = await puppeteer.launch()

  for (let {link} of required) {

    ++count

    emitter.emit(pulp.events.subTaskProgress, `downloading and storing "${chalk.bold(link)}" (${count} of ${required.length})`)
    storeArticle(db, link, await downloadArticle(browser, link))
  }

  db.close()
}

/**
 * Download SlateStarCodex articles, as markdown, to a database. Idempotent.
 *
 * @return {undefined}.
 */
const command = {
  name: 'download',
  dependencies: []
}

command.task = async (_, emitter) => {
  const links = await retrieveLinks(emitter)
  const status = await downloadMissingContent(links, emitter)
}

module.exports = command
