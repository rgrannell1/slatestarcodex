
const pulp = require('@rgrannell/pulp')
const markdown = require('@rgrannell/markdown')
const fs = require('fs').promises
const sqlite = require('sqlite')
const showdown = require('showdown')
const constants = require('../constants')
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

  await db.each(constants.queries.retrieveAll, async (err, row) => {
    const {body, title} = JSON.parse(row.content)
    const links = extractLinks(body).filter(excludeLinks)

    if (links.length > 0) {
      state.push({title, links})
    }
  })

  const sections = []

  for (const {title, links} of state) {
    sections.push(markdown.h2(title))
    sections.push(markdown.list(links).join('\n'))
  }

  const document = new showdown.Converter().makeHtml(markdown.document(sections))

  await fs.writeFile(constants.paths.links, document)
  emitter.emit(pulp.events.subTaskProgress, `annotated all downloaded data (${state.updated} updated).`)

  db.close()
}

module.exports = command
