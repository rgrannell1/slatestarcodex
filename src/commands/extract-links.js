
const pulp = require('@rgrannell/pulp')
const markdown = require('@rgrannell/markdown')
const mustache = require('mustache')
const fs = require('fs').promises
const sqlite = require('sqlite')
const showdown = require('showdown')
const puppeteer = require('puppeteer')

const constants = require('../shared/constants')
const dbUtils = require('../shared/database')

const moment = require('moment')
const extractLinks = require('markdown-link-extractor')

const excludePatterns = [
  /gif$/,
  /png$/,
  /jpg$/,
  /jpeg$/,
  /slatestarcodex/
]

const excludeLinks = link => {
  return !excludePatterns.some(reject => reject.test(link))
}

const getDocumentSize = async fpath => {
  const stat = await fs.stat(fpath)
  return (stat.size / 1e6).toFixed(1)
}

/**
 * Render the downloaded blog-posts to PDF.
 *
 * @param {Object} paths    paths used by this function.
 *
 * @return {Promise} a result promise
 */
const renderHtmlToPdf = async (paths, emitter) => {
  const browser = await puppeteer.launch({
    headless: true,
    timeout: constants.timeout.loadRenderedSite
  })
  const page = await browser.newPage()

  emitter.emit(pulp.events.subTaskProgress, `Loading SlateStarCodex Links HTML (${await getDocumentSize(paths.site)}Mb)`)

  await page.goto(`file://${paths.site}`, {
    timeout: 0
  })

  emitter.emit(pulp.events.subTaskProgress, `Rendering SlateStarCodex Links to PDF ⚗️`)

  await page.pdf({path: paths.pdf})

  emitter.emit(pulp.events.subTaskProgress, `Finished rendering SlateStarCodex Links PDF (${await getDocumentSize(paths.pdf)}) ⚗️`)

  await browser.close()
}

const command = {
  name: 'extract-links',
  dependencies: []
}

/**
 * Add metadata
 *
 * @return {Promise} a result promise
 */
command.task = async (_, emitter) => {
  const db = await sqlite.open(constants.paths.database)
  const state = []

  emitter.emit(pulp.events.subTaskProgress, `extracting links from SlateStarCodex ⚗️`)

  await db.each(constants.queries.retrieveAll, async (err, row) => {
    const {body, title, metadata} = JSON.parse(row.content)
    const links = extractLinks(body).filter(excludeLinks).sort()

    if (links.length > 0 && metadata.tags.includes('links')) {
      state.push({title, links})
    }
  })

  const sections = []

  for (const {title, links} of state) {
    const hrefs = links.map(link => {
      return markdown.link(decodeURIComponent(link), link)
    })
    sections.push(markdown.h2(title))
    sections.push(markdown.list(hrefs).join('\n'))
  }

  const toc = markdown.list(state.map(data => data.title))
  const body = new showdown.Converter().makeHtml(markdown.document(sections))
  const tableOfContents = new showdown.Converter().makeHtml(markdown.document(toc))

  const read = (await fs.readFile(constants.paths.linksTemplate)).toString()
  const rendered = mustache.render(read, {body, tableOfContents})

  await fs.writeFile(constants.paths.links, rendered)

  await renderHtmlToPdf({
    site: constants.paths.links,
    pdf: constants.paths.linksPdf
  }, emitter)

  db.close()
}

module.exports = command
