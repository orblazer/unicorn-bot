import * as minimist from 'minimist'
import UnicornBot from './UnicornBot'

global.isDev = process.env.NODE_ENV !== 'production'

// Parse arguments
const parseArgs = minimist(process.argv.slice(2), {
  string: ['token'],
  boolean: ['verbose'],
  alias: {
    t: 'token'
  }
})
global.verbose = parseArgs.verbose || global.isDev

// Overwrite console
require('./log')

// Initialize
const unicornBot = new UnicornBot(parseArgs.token)

process.on('unhandledRejection', (err: Error) => {
  unicornBot.reportError('unknown', err)
})
process.on('uncaughtException', (err: Error) => {
  unicornBot.reportError('unknown', err)
})

process.on('SIGTERM', () => {
  unicornBot.shutdown().then(() => {
    process.exit(0)
  }).catch(() => {
    process.exit(1)
  })
})
