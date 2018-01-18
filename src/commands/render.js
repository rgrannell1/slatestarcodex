
const fs = require('fs')
const sqlite = require('sqlite')
const winston = require('winston')
const showdown = require('showdown')
const mustache = require('mustache')
const constants = require('../constants')

const parseEntry = ({url, content}) => {
	const {title, date, body} = JSON.parse(content)
	return {url, title, date, body}
}

/**
 * render each article as HTML.
 *
 * @return {string} return a HTML document.
 */
const renderHTML = async () => {
	const db = await sqlite.open(constants.paths.database)

	const posts = await db.all(constants.queries.retrieveAll)
	const body = posts
		.map(parseEntry)
		.slice(0, 10)
		.map(data => {
			const markdown = [
				`# ${data.title}`,
				'',
				`Published on ${data.date}`,
				'',
				data.body
			].join('\n')

			return [
				'<article>',
				new showdown.Converter().makeHtml(markdown),
				'</article>'
			].join('\n');
		})

	const read = fs.readFileSync(constants.paths.template).toString()
	const rendered = mustache.render(read, {
		body: body.join('\n')
	})

	fs.writeFileSync('foo.html', rendered)

	db.close()
}

const renderPDF = async () => {

}

module.exports = async () => {
  // load from database

  const db = await sqlite.open(constants.paths.database)
  const rendered = await renderHTML()

}
