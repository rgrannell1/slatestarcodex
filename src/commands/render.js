
const fs = require('fs')
const sqlite = require('sqlite')
const winston = require('winston')
const showdown = require('showdown')
const mustache = require('mustache')
const puppeteer = require('puppeteer')
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
		.slice(100)
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

const renderPDF = async () => {
  const browser = await puppeteer.launch({
  	headless: true,
  	timeout: constants.timeout.loadRenderedSite
  })
  const page = await browser.newPage()
  await page.goto(`file://${constants.paths.site}`)
  await page.pdf({
  	path: constants.paths.pdf
  })

  await browser.close()
}

module.exports = async () => {
  const db = await sqlite.open(constants.paths.database)
  const rendered = await renderHTML()
  await renderPDF()
}
