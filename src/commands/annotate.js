
const pulp = require('@rgrannell/pulp')
const sqlite = require('sqlite')
const constants = require('../constants')
const dbUtils = require('../shared/database')
const moment = require('moment')

const annotations = {}

/*
 *
 */
annotations.lastModified = (_, metadata) => {
  metadata.lastModified = moment().format('YYYY-MM-DD hh:mm:ss')
  return metadata
}

/*
 * Detect whether the blog post is a list of links
 */
annotations.links = (data, metadata) => {
  const {title} = data

  if (title.includes('Links') || title.includes('links')) {
    metadata.tags.push('links')
  }

  return metadata
}

const command = {
  name: 'annotate',
  dependencies: []
}

/**
 * Add metadata
 *
 * @return {Promise} a result promise
 */
command.task = async (_, emitter) => {
  const db = await sqlite.open(constants.paths.database)
  const state = {updated: 0}

  await db.each(constants.queries.retrieveAll, async (err, row) => {
    const data = JSON.parse(row.content)
    data.metadata = {tags: []}

    for (const annotation of Object.keys(annotations)) {
      data.metadata = annotations[annotation](data, data.metadata)
    }

    await dbUtils.storeArticle(db, row.url, data, {
      mode: 'update'
    })

    state.updated++
  })

  emitter.emit(pulp.events.subTaskProgress, `annotated all downloaded data (${state.updated} updated).`)
  db.close()
}

module.exports = command
