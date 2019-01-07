
const fs = require('fs').promises
const pulp = require('@rgrannell/pulp')
const sqlite = require('sqlite')
const showdown = require('showdown')
const mustache = require('mustache')
const puppeteer = require('puppeteer')
const constants = require('../shared/constants')

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

	const read = (await fs.readFile(constants.paths.template)).toString()
	const rendered = mustache.render(read, {
		body: body.join('\n')
	})

  await fs.writeFile(constants.paths.site, rendered)
	db.close()
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

  emitter.emit(pulp.events.subTaskProgress, `Loading SlateStarCodex HTML (${await getDocumentSize(paths.site)}Mb)`)

  await page.goto(`file://${paths.site}`, {
    timeout: 0
  })

  emitter.emit(pulp.events.subTaskProgress, `Rendering SlateStarCodex to PDF ⚗️`)

  await page.pdf({path: paths.pdf})

  emitter.emit(pulp.events.subTaskProgress, `Finished rendering SlateStarCodex PDF (${await getDocumentSize(paths.pdf)}) ⚗️`)

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
  await renderHtmlToPdf(paths, emitter)
}

module.exports = command
