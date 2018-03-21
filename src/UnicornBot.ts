import { UnicornBot as UBot } from '../types'
import * as Discord from 'discord.js'
import Command from './commands/Command'
import HelpCommand from './commands/HelpCommand'
import SongCommand from './commands/SongCommand'
import VKickCommand from './commands/VKickCommand'

const messages = require('../store/messages.json')
const tokenRegex = /[a-zA-Z0-9]{24}\.[a-zA-Z0-9]{6}\.[a-zA-Z0-9_\-]{27}|mfa\.[a-zA-Z0-9_\-]{84}/

export default class UnicornBot implements UBot {
  private _discordClient: Discord.Client
  private _messages: Discord.Message[] = []
  private _stopped: boolean = false

  readonly commands: UBot.Command[] = []

  /**
   * Initialize the class
   * @param {string} token The token of the bot
   */
  constructor (token: string) {
    if (!tokenRegex.test(token.trim())) {
      throw new Error(`The token "${token}" is not valid discord token`)
    }
    this._discordClient = new Discord.Client()

    this._initDiscord(token).then(() => {
      this.registerCommand(new HelpCommand(this))
      this.registerCommand(new SongCommand(this))
      this.registerCommand(new VKickCommand(this))

      this._discordClient.on('message', (message: Discord.Message) => {
        if (this._stopped) return

        if (message.content.startsWith('!')) {
          const args: string[] = message.content.replace('!', '').split(' ')
          const command: UBot.Command | undefined = this.commands.find(value => value.aliases.indexOf(args[0]) > -1)

          if ((message.content === '!stop') && message.member.hasPermission('ADMINISTRATOR')) {
            message.delete().then(() => {
              this.shutdown().then(() => {
                process.exit(0)
              })
            })

            return
          }

          if (typeof command != 'undefined') {
            if (command.needPermission && !message.member.hasPermission(command.needPermission)) {
              this.reply(message, this.getMessages('unauthorized').replace('$0', command.aliases[0]))
              return
            }

            command.execute(message, args.slice(1))
          } else {
            this.reply(message, this.getMessages('commands.notFound'))
          }

          return
        }
      })

      this._discordClient.on('messageDelete', (message: Discord.Message) => {
        const index = this._messages.indexOf(message)
        if (index !== -1) this._messages.splice(index, 1)
      })
    })
  }

  shutdown (): Promise<void> {
    return new Promise<void>(async resolve => {
      this._stopped = true

      // Shutdown commands
      let cmdPromises: Promise<void>[] = []
      this.commands.forEach((command: UBot.Command) => {
        cmdPromises.push(command.shutdown())
      })
      await Promise.all(cmdPromises)

      // Make bot invisible
      await this._discordClient.user.setPresence({
        status: 'invisible'
      })

      // Remove sended messages
      let msgPromises: Promise<Discord.Message>[] = []
      this._messages.forEach((message: Discord.Message) => {
        msgPromises.push(new Promise<Discord.Message>(resolve2 => message.delete().then(() => resolve2(), () => resolve2())))
      })
      await Promise.all(msgPromises)

      await this._discordClient.destroy()
      console.log('Logged out from %s - %s', this._discordClient.user.tag, this._discordClient.user.id)

      resolve()
    })
  }

  /**
   * Initialize the discord client
   * @private
   * @param {string} token The token of the bot
   * @return {Promise<void>}
   */
  private _initDiscord (token: string): Promise<void> {
    return new Promise<void>(resolve => {
      this._discordClient = new Discord.Client()

      this._discordClient.on('ready', () => {
        console.log('Logged in as %s - %s', this._discordClient.user.tag, this._discordClient.user.id)

        this._discordClient.user.setPresence({
          game: {
            name: 'Usage: !help'
          }
        }).catch((error: Error) => {
          this.reportError('', error)
        })
        resolve()
      })

      this._discordClient.login(token.trim())
    })
  }

  registerCommand (command: string | UBot.Command): void {
    if (this._stopped) return

    if ((command instanceof Command) && (this.commands.indexOf(command) === -1)) {
      if (!command.initialized) {
        command.init();
        (command as any)._initialized = true
      }

      this.commands.push(command)
    } else if (typeof command === 'string') {
      const suffix: string = command.endsWith('Command') ? '' : 'Command'

      import('./commands/' + command + suffix).then((cmd) => {
        const command: UBot.Command = new (cmd.default)(this)
        command.init();
        (command as any)._initialized = true
        this.commands.push(command)
      })
    }
  }

  send (channel: Discord.TextChannel | Discord.GroupDMChannel | Discord.DMChannel, message?: Discord.StringResolvable, options?: Discord.MessageOptions | Discord.RichEmbed | Discord.Attachment, duration: number = 15000): Promise<Discord.Message | Discord.Message[]> {
    if (this._stopped) return Promise.reject(new Error('The bot is stopped'))

    let messageSend: Promise<Discord.Message | Discord.Message[]> = channel.send(message, options)

    messageSend.then((message: Discord.Message) => {
      this._messages.push(message)

      if (duration) {
        message.delete(duration)
      }
    }).catch((error: Error) => {
      if (channel instanceof Discord.TextChannel) {
        this.reportError('g:' + (channel as Discord.TextChannel).guild.id, error)
      } else if (channel instanceof Discord.GroupDMChannel) {
        this.reportError('gdm:' + (channel as Discord.GroupDMChannel).ownerID, error)
      } else {
        this.reportError('dm:' + (channel as Discord.DMChannel).recipient.id, error)
      }
    })

    return messageSend
  }

  async reply (message: Discord.Message, reply?: Discord.StringResolvable, options?: Discord.MessageOptions, remove: boolean = true, duration: number = 15000): Promise<Discord.Message | Discord.Message[]> {
    if (this._stopped) return Promise.reject(new Error('The bot is stopped'))

    let messageSend: Promise<Discord.Message | Discord.Message[]>

    if (message) {
      if (remove) {
        await message.delete()
      }
      messageSend = message.reply(reply, options)
    } else {
      messageSend = new Promise<Discord.Message>((resolve, reject) => reject(new Error('The original message is not passed')))
    }

    messageSend.then((message: Discord.Message) => {
      this._messages.push(message)

      if (duration) {
        message.delete(duration)
      }
    }).catch((error: Error) => {
      this.reportError('g:' + message.guild.id, error)
    })

    return messageSend
  }

  reportError (owner: string, error: Error): void {
    if (error.message.trim() === 'Unknown Message') return
    if (owner === '') owner = 'global'

    console.error(owner + ' ' + error.message)
  }

  getMessages (path: string): string {
    return path.split('.').reduce(function (prev, curr) {
      return prev ? prev[curr] : messages.ERROR
    }, messages)
  }

  get client (): Discord.Client {
    return this._discordClient
  }

  get stopped (): boolean {
    return this._stopped
  }
}
