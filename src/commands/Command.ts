import { UnicornBot } from '../../types'
import * as Discord from 'discord.js'

export default abstract class Command implements UnicornBot.Command {
  protected _instance: UnicornBot
  protected _initialized: boolean = false

  abstract description: string
  abstract aliases: string[]
  abstract usage: string
  usages: Map<string, { command: string, description: string }> = new Map<string, { command: string, description: string }>()
  abstract msgPrefix: string
  needPermission: Discord.PermissionResolvable | false = false

  constructor (instance: UnicornBot) {
    this._instance = instance
  }

  abstract init (): void

  abstract shutdown (): Promise<void>

  abstract execute (message: Discord.Message, args: string[]): void

  protected _sendUsage (message: Discord.Message, filter: string[] = []) {
    message.delete().then((message: Discord.Message) => {
      const haveUsages: boolean = this.usages.size > 0
      const embed: Discord.RichEmbed = new Discord.RichEmbed({
        title: this._instance.getMessages('commands.usageTitle').replace('$0', this.aliases[0] || '***UNKNOWN***'),
        description: this.description + '\n\u200B'
      })

      if (haveUsages) {
        this.usages.forEach((usage: { command: string, description: string }, key: string) => {
          if ((filter.length === 0) || (filter.indexOf(key) !== -1)) {
            embed.addField(usage.command, '  ' + usage.description, false)
          }
        })
      } else {
        embed.addField(this.usage, '\u200B', false)
      }

      this._instance.send(message.channel, '<@' + message.member.id + '>', embed)
    })
  }

  get initialized (): boolean {
    return this._initialized
  }
}

