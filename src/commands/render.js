
const fs = require('fs')
const pulp = require('@rgrannell/pulp')
const sqlite = require('sqlite')
const showdown = require('showdown')
const mustache = require('mustache')
const puppeteer = require('puppeteer')
const constants = require('../constants')

/**
 * Process an entry loaded from the database
 *
 * @param  {String} options.url     the content URL
 * @param  {String} options.content the content itself
 *
 * @return {Object}                 an object containing
 *     data for a particular blog post.
 */
const parseEntry = ({url, content}) => {
	return Object.assign({url}, JSON.parse(content))
}

/**
 * render each article as HTML.
 *
 * @return {string} return a HTML document.
 */
const renderHTML = async (paths, emitter) => {
	const db = await sqlite.open(constants.paths.database)

	const posts = await db.all(constants.queries.retrieveAll)
	const body = posts
		.map(parseEntry)
		.map(data => {
			const markdown = [
				`# ${data.title}`,
				'',
				`Slate Star Codex · ${data.date}`,
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
	fs.writeFileSync(constants.paths.site, rendered)
	db.close()
}

/**
 * Render the downloaded blog-posts to PDF.
 *
 * @param {Object} paths    paths used by this function.
 *
 * @return {Promise} a result promise
 */
const renderPDFToHtml = async paths => {
  const browser = await puppeteer.launch({
  	headless: true,
  	timeout: constants.timeout.loadRenderedSite
  })
  const page = await browser.newPage()
  await page.goto(`file://${paths.site}`)
  await page.pdf({path: paths.pdf})

  await browser.close()
}

const command = {
  name: 'render',
  dependencies: []
}

/**
 * Render SlateStarCodex to PDF
 *
 * @return {Promise} a result promise
 */
command.task = async (_, emitter) => {
  const paths = constants.paths
  const db = await sqlite.open(paths.database)
  const rendered = await renderHTML(paths, emitter)
  await renderPDFToHtml(paths, emitter)
}

module.exports = command
