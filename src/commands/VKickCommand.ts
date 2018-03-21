import Command from './Command'
import * as Discord from 'discord.js'
import { GuildMember } from 'discord.js'
import { randomID } from '../utils/Random'

export default class VKickCommand extends Command {
  description: string = 'Kick an user of voice channel'
  aliases: string[] = ['vkick']
  usage: string = '!vkick (user)'
  msgPrefix: string = 'commands.vkick'
  needPermission: Discord.PermissionResolvable = 'KICK_MEMBERS'

  init (): void {
    this.description = this._instance.getMessages(this.msgPrefix + '.description')
  }

  shutdown (): Promise<void> {
    return Promise.resolve()
  }

  execute (message: Discord.Message, args: string[]): void {
    if ((args.length === 0) || (message.mentions.users.size === 0)) {
      this._sendUsage(message)
      return
    }

    message.guild.fetchMember(message.mentions.users.first()).then((member: GuildMember) => {
      if (!member.voiceChannel) {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notVoiceChannel').replace('$0', member.id))
        return
      }

      member.guild.createChannel(randomID(), 'voice').then((channel: Discord.VoiceChannel) => {
        member.setVoiceChannel(channel).then(() => {
          channel.delete('Kick user <@' + member.id + '>').then(() => {
            this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.kicked').replace('$0', member.id))
          })
        })
      })
    })
  }
}
