
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
    links: path.join(__dirname, '../data/links.html'),
    database: path.join(__dirname, '../data/content.sqlite'),
    template: path.join(__dirname, '../src/static/template.html'),
    site: path.join(__dirname, '../data/site.html'),
    pdf: path.join(__dirname, '../data/site.pdf')
  },
  timeout: {
    loadRenderedSite: 120 * 1000
  }
}

constants.queries.getByUrl = 'SELECT * FROM Content WHERE url = ?'
constants.queries.createTable = `CREATE TABLE IF NOT EXISTS Content (
  url TEXT PRIMARY KEY,
  content BLOB NOT NULL
)`

constants.queries.insertContent = 'INSERT INTO Content (url, content) VALUES ($url, $content)'
constants.queries.updateContent = `UPDATE Content
SET url = $url, content = $content
WHERE url = $url`
constants.queries.retrieveAll = 'SELECT url, content FROM Content'

module.exports = constants
