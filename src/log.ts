import * as colors from 'colors/safe'
import * as util from 'util'

// Define custom theme
colors.setTheme({
  data: ['white', 'italic'],
  log: 'white',
  info: ['blue', 'bold'],
  warn: 'yellow',
  debug: 'gray',
  error: 'red'
})

const oldConsole = {
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
}
const now = () => '[' + new Date().toISOString() + '] '

console.log = function () {
  oldConsole.log(now() + colors.info(util.format.apply(util, arguments)))
}
console.debug = function () {
  if (!global.verbose) return

  oldConsole.debug(now() + colors.debug(util.format.apply(util, arguments)))
}
console.info = function () {
  oldConsole.info(now() + colors.info(util.format.apply(util, arguments)))
}
console.warn = function () {
  oldConsole.warn(now() + colors.warn(util.format.apply(util, arguments)))
}
console.error = function () {
  oldConsole.error(now() + colors.error(util.format.apply(util, arguments)))
}
