
const pulp = require('@rgrannell/pulp')
const commands = require('./src/commands')

const tasks = pulp.tasks()

tasks.addAll(commands)

tasks.run().catch(err => {
  console.log(err)
  process.exit(1)
})
