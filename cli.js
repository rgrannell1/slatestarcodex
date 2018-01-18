
const neodoc = require('neodoc')
const commands = require('./src/commands')

const docs = {}

docs.main = `
Usage:
	cli.js download
	cli.js render
`

const args = neodoc.run(docs.main)

if (args.download) {
	commands.download()
} else if (args.render) {
	commands.render()
}
