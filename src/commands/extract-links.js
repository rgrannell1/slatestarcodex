
const pulp = require('@rgrannell/pulp')
const sqlite = require('sqlite')
const constants = require('../constants')
const dbUtils = require('../shared/database')

const moment = require('moment')
const extractLinks = require('markdown-link-extractor')

const excludePatterns = [
  /png$/,
  /jpg$/,
  /jpeg$/
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

    if (links) {
      state.push({title, links})
    }
  })

  console.log(JSON.stringify(state, null, 2))
  db.close()

  emitter.emit(pulp.events.subTaskProgress, `annotated all downloaded data (${state.updated} updated).`)
}

module.exports = command
