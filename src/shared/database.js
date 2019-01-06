
const constants = require('../constants')
const sqlite = require('sqlite')

/**
 * Write an article to the local database.
 *
 * @param  {Object} db      the database client.
 * @param  {string} link    a URL to an article.
 * @param  {object} content structured content downloaded from the article
 * @param  {object} options optional arguments:
 *  - mode a string; insert or update
 *
 * @return {undefined}
 */
const storeArticle = async (db, link, content, {mode}) => {
  const query = mode === 'insert'
    ? constants.queries.insertContent
    : constants.queries.updateContent

  try {
    await db.run(query, {
      $url: link,
      $content: JSON.stringify(content)
    })

  } catch (err) {
    console.error(`an error occurred while storing content: ${err.message}`)
  }
}

module.exports = {
  storeArticle
}
