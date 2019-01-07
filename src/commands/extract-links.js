
const pulp = require('@rgrannell/pulp')
const markdown = require('@rgrannell/markdown')
const mustache = require('mustache')
const fs = require('fs').promises
const sqlite = require('sqlite')
const showdown = require('showdown')
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

  const body = new showdown.Converter().makeHtml(markdown.document(sections))

  const read = (await fs.readFile(constants.paths.linksTemplate)).toString()
  const rendered = mustache.render(read, {body})

  await fs.writeFile(constants.paths.links, rendered)
  db.close()
}

module.exports = command
