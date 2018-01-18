
const path = require('path')

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
    database: path.join(__dirname, '../data/content.sqlite'),
    template: path.join(__dirname, '../src/static/template.html')
  }
}

constants.queries.getByUrl = 'SELECT * FROM Content WHERE url = ?'
constants.queries.createTable = `CREATE TABLE IF NOT EXISTS Content (
  url TEXT PRIMARY KEY,
  content BLOB NOT NULL
)`

constants.queries.insertContent = 'INSERT INTO Content (url, content) VALUES ($url, $content)'
constants.queries.retrieveAll = 'SELECT url, content FROM Content'

module.exports = constants