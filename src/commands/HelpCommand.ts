import Command from './Command'
import * as Discord from 'discord.js'
import { UnicornBot } from '../../types'

export default class SongCommand extends Command {
  description: string = 'List commands'
  aliases: string[] = ['help', 'h']
  usage: string = '!help'
  msgPrefix: string = 'commands.help'

  init (): void {
    this.description = this._instance.getMessages(this.msgPrefix + '.description')
  }

  shutdown (): Promise<void> {
    return Promise.resolve()
  }

  execute (message: Discord.Message, args: string[]): void {
    message.delete().then(() => {
      const embed: Discord.RichEmbed = new Discord.RichEmbed({
        title: this._instance.getMessages(this.msgPrefix + '.title'),
        description: '\u200B'
      })

      this._instance.commands.forEach((command: UnicornBot.Command) => {
        embed.addField(command.usage, command.description, false)
      })

      this._instance.send(message.channel, '<@' + message.member.id + '>', embed)
    })
  }
}
