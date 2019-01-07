
const pulp = require('@rgrannell/pulp')
const markdown = require('@rgrannell/markdown')
const sqlite = require('sqlite')
const showdown = require('showdown')
const puppeteer = require('puppeteer')
const mustache = require('mustache')
const URL = require('url')
const expect = require('chai').expect

const fs = require('fs').promises

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

const groupUrlByHost = posts => {
  expect(posts).to.be.an('array')
  expect(posts).to.not.be.empty

  const groups = {}

  posts.forEach(data => {
    data.links.forEach(link => {
      const host = URL.parse(link).host

      groups[host] = groups.hasOwnProperty(host)
        ? groups[host].concat([link])
        : [link]
    })
  })

  expect(Object.keys(groups)).to.not.be.empty

  return groups
}

const extractPostLinks = async emitter => {
  const db = await sqlite.open(constants.paths.database)
  const posts = []

  emitter.emit(pulp.events.subTaskProgress, `extracting links from SlateStarCodex ⚗️`)

  await db.each(constants.queries.retrieveAll, async (err, row) => {
    const {body, title, metadata} = JSON.parse(row.content)
    const links = extractLinks(body).filter(excludeLinks).sort()

    if (links.length > 0 && metadata.tags.includes('links')) {
      posts.push({title, links})
    }
  })

  expect(posts).to.not.be.empty
  return posts
}

const render = {}

render.linkPosts = posts => {
  let sections = []

  posts.forEach(data => {
    const hrefs = data.links.map(link => {
      return markdown.link(decodeURIComponent(link), link)
    })

    sections = sections.concat([
      markdown.h2(data.title),
      markdown.list(hrefs).join('\n')
    ])
  })

  return sections
}

render.tableOfContents = async emitter => {
  const posts = await extractPostLinks(emitter)

  const toc = markdown.list(posts.map(data => data.title))
  return new showdown.Converter().makeHtml(markdown.document(toc))
}

render.linksByHost = async emitter => {
  const posts = await extractPostLinks(emitter)
  const linksByHost = groupUrlByHost(posts)

  let parts = []
  Object.keys(linksByHost).sort().map(host => {
    const links = linksByHost[host]
      .sort()
      .map(link => markdown.link(link))

    parts.push(markdown.h2(host))
    parts = parts.concat(markdown.list(links))
  })

  const html = new showdown.Converter().makeHtml(markdown.document(parts))
  return html
}

render.body = async emitter => {
  let body = []
  const posts = await extractPostLinks(emitter)

  posts.forEach(data => {
    const hrefs = data.links.map(link => {
      return markdown.link(link, link)
    })

    body = body
      .concat([''])
      .concat([markdown.h2(data.title)])
      .concat(markdown.list(hrefs))
  })

  const html = new showdown.Converter().makeHtml(markdown.document(body))
  return html
}

/**
 * Add metadata
 *
 * @return {Promise} a result promise
 */
command.task = async (_, emitter) => {
  const vars = {}
  vars.body = await render.body(emitter)
  vars.tableOfContents = await render.tableOfContents(emitter)
  vars.byHost = await render.linksByHost(emitter)

  const template = (await fs.readFile(constants.paths.linksTemplate)).toString()
  const rendered = mustache.render(template, vars)
  await fs.writeFile(constants.paths.links, rendered)
  await renderHtmlToPdf({
    site: constants.paths.links,
    pdf: constants.paths.linksPdf,
  }, emitter)
}

module.exports = command
