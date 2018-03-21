import { Readable } from 'stream'
import * as Discord from 'discord.js'
import * as ytdl from 'ytdl-core'
import Command from './Command'
import { UnicornBot } from '../../types'
import { secondToDate } from '../utils/UBDate'

const regexYTURL: RegExp = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)$/
const percentageChange: number = 2

export default class SongCommand extends Command {
  private _connections: Map<string, UnicornBot.SongConnection> = new Map<string, UnicornBot.SongConnection>()

  description: string = 'Manage the song'
  aliases: string[] = ['song']
  usage: string = '!song [join/leave/play/pause/skip/volume/info] (url/volume)'
  msgPrefix: string = 'commands.song'

  init (): void {
    this.description = this._instance.getMessages(this.msgPrefix + '.description')

    this.usages.set('join', {
      command: '!song join',
      description: this._instance.getMessages(this.msgPrefix + '.usages.join')
    })
    this.usages.set('leave', {
      command: '!song leave',
      description: this._instance.getMessages(this.msgPrefix + '.usages.leave')
    })
    this.usages.set('play', {
      command: '!song play (url)',
      description: this._instance.getMessages(this.msgPrefix + '.usages.play')
    })
    this.usages.set('pause', {
      command: '!song pause',
      description: this._instance.getMessages(this.msgPrefix + '.usages.pause')
    })
    this.usages.set('skip', {
      command: '!song skip',
      description: this._instance.getMessages(this.msgPrefix + '.usages.skip')
    })
    this.usages.set('volume', {
      command: '!song volume (0-400)',
      description: this._instance.getMessages(this.msgPrefix + '.usages.volume')
    })
    this.usages.set('info', {
      command: '!song info',
      description: this._instance.getMessages(this.msgPrefix + '.usages.info')
    })
  }

  shutdown (): Promise<void> {
    return new Promise<void>(resolve => {
      this._connections.forEach((connection: UnicornBot.SongConnection) => {
        if (connection.dispatcher) {
          connection.dispatcher.end('stopped')
        }

        connection.connection.disconnect()
        connection.queue.clear()
      })
      this._connections.clear()

      resolve()
    })
  }

  execute (message: Discord.Message, args: string[]): void {
    if (args.length === 0) {
      this._sendUsage(message)
      return
    }

    switch (args[0]) {
      case 'join':
        return this._join(message, args)
      case 'leave':
        return this._leave(message, args)
      case 'play':
        return this._play(message, args)
      case 'pause':
        return this._pause(message, args)
      case 'skip':
        return this._skip(message, args)
      case 'volume':
        return this._volumeCmd(message, args)
      case 'info':
        return this._info(message, args)
      default:
        this._sendUsage(message)
        break
    }
  }

  private _join (message: Discord.Message, args: string[]): void {
    if (args.length !== 1) {
      this._sendUsage(message, ['join'])
      return
    }

    if (!message.member.voiceChannel) {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notVoiceChannel'))
      return
    }

    message.member.voiceChannel.join().then((connection: Discord.VoiceConnection) => {
      const guildId: Discord.Snowflake = connection.channel.guild.id

      connection.player.on('error', (...e: any[]) => {
        console.error('player', ...e)

        e.forEach(err => this._instance.reportError('g:' + connection.channel.guild.id, err))
      })

      if (!this._connections.has(guildId)) {
        this._connections.set(guildId, {
          connection,
          speakings: [],
          volume: 1,
          reducedVolume: false,
          queue: new Map<string, UnicornBot.SongData>()
        })

        connection.on('speaking', (user: Discord.User, speaking: boolean) => {
          const conn = this._connections.get(guildId)
          if ((!conn || !conn.dispatcher) || (user.id === this._instance.client.user.id)) return

          const index = conn.speakings.indexOf(user)
          if (speaking && (index === -1)) {
            conn.speakings.push(user)
          } else if (!speaking && (index !== -1)) {
            conn.speakings.splice(index, 1)
          }

          console.log(conn.speakings.length, conn.reducedVolume, conn.volume)
          if ((conn.speakings.length > 0) && !conn.reducedVolume) {
            conn.dispatcher.setVolume(conn.volume = Math.round((conn.volume / percentageChange) * 100) / 100)
            conn.reducedVolume = true
          } else if (conn.reducedVolume) {
            conn.dispatcher.setVolume(conn.volume = Math.round((conn.volume * percentageChange) * 100) / 100)
            conn.reducedVolume = false
          }
        })

        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.ready'))
      } else {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.already'))
      }
    }).catch((error: Error) => {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.failedJoin'))

      this._instance.reportError('g:' + message.guild.id, error)
    })
  }

  private _leave (message: Discord.Message, args: string[]): void {
    if (args.length !== 1) {
      this._sendUsage(message, ['leave'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      if (connection.dispatcher) {
        connection.dispatcher.end()
      }
      connection.connection.disconnect()

      this._connections.delete(message.guild.id)
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.leave'))
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _play (message: Discord.Message, args: string[]): void {
    if (args.length > 2) {
      this._sendUsage(message, ['play'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      const playSong = args.length === 2

      if (connection.dispatcher) {
        if (connection.dispatcher.paused) {
          connection.dispatcher.resume()
          this._updateInfo(connection)

          if (!playSong) {
            this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.resume'))
          }
        } else if (!playSong) {
          this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.resumed'))
        }
      } else if (!playSong) {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.noSong'))
      }

      if (playSong && regexYTURL.test(args[1])) {
        message.delete().then((message: Discord.Message) => {
          const url = args[1]

          if (!connection.queue.has(url)) {
            connection.queue.set(url, {
              url: url,
              message
            })
          }

          this._infoSong(message.channel, connection, url, message.author.id, 10000, true).then((message: Discord.Message) => {
            if (connection.queue.size <= 1) {
              this._processQueue(connection, message)
            }
          })
        }).catch((error: Error) => {
          this._instance.reportError('g:' + message.guild.id, error)
        })
      } else if (playSong) {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.play.invalidUrl'))
      }
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _pause (message: Discord.Message, args: string[]): void {
    if (args.length !== 1) {
      this._sendUsage(message, ['pause'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      if (connection.dispatcher) {
        if (!connection.dispatcher.paused) {
          connection.dispatcher.pause()
          this._updateInfo(connection)

          this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.pause'))
        } else {
          this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.paused'))
        }
      } else {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.noSong'))
      }
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _skip (message: Discord.Message, args: string[]): void {
    if (args.length !== 1) {
      this._sendUsage(message, ['skip'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      if (connection.dispatcher) {
        connection.dispatcher.end('skipped')
        connection.queue.values().next().value.message.delete()
      } else {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.noSong'))
      }
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _volumeCmd (message: Discord.Message, args: string[]): void {
    if (args.length > 2) {
      this._sendUsage(message, ['volume'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      if (connection.dispatcher) {
        if (args.length === 1) {
          this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.volume.current').replace('$0', (connection.volume * 100) + '%'))
        } else {
          const volume: number = Number(args[1])

          if ((volume >= 0) && (volume <= 400)) {
            connection.dispatcher.setVolume(connection.volume = (volume / 100))
            this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.volume.change').replace('$0', volume + '%'))
          } else {
            this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.volume.range')
              .replace('$0', volume + '%')
              .replace('$1', '0%')
              .replace('$2', '400%'))
          }
        }
      } else {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.noSong'))
      }
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _info (message: Discord.Message, args: string[]): void {
    if (args.length !== 1) {
      this._sendUsage(message, ['info'])
      return
    }

    const connection: UnicornBot.SongConnection | undefined = this._connections.get(message.guild.id)
    if (connection) {
      if (connection.dispatcher) {
        const embed: Discord.RichEmbed = new Discord.RichEmbed({
          title: this._instance.getMessages(this.msgPrefix + '.info.title'),
          description: this._instance.getMessages(this.msgPrefix + '.info.nbSong').replace('$0', String(connection.queue.size)) + '\n'
          + this._instance.getMessages(this.msgPrefix + '.info.volume').replace('$0', (connection.volume * 100) + '%') +
          +'\n\u200B'
        })

        let index: number = 0
        connection.queue.forEach((song: UnicornBot.SongData) => {
          if (song.data && (index < 25)) {
            let title: string = song.data.title
            if (index === 0) {
              title = '__' + title + '__'
            }

            embed.addField(title, [
              '\u200B   ' + this._instance.getMessages(this.msgPrefix + '.info.time').replace('$0', song.data.time),
              '   ' + this._instance.getMessages(this.msgPrefix + '.info.proposer').replace('$0', '<@' + song.data.proposerId + '>'),
              '   ' + this._instance.getMessages(this.msgPrefix + '.info.url').replace('$0', song.url),
              (index > 0) ? '   ' + this._instance.getMessages(this.msgPrefix + '.play.inQueue').replace('$0', String(index)).replace('$1', String(connection.queue.size - 1)) : ''
            ], false)

            index++
          }
        })

        message.delete().then(() => {
          this._instance.send(message.channel, '<@' + message.member.id + '>', embed, 30000)
        }).catch((error: Error) => {
          this._instance.reportError('g:' + message.guild.id, error)
        })
      } else {
        this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.noSong'))
      }
    } else {
      this._instance.reply(message, this._instance.getMessages(this.msgPrefix + '.notJoined'))
    }
  }

  private _updateInfo (connection: UnicornBot.SongConnection) {
    // TODO 03/02/2018 Wait v12 of Discord.js
    /* const item: UnicornBot.SongData = connection.queue.values().next().value
    const embed: Discord.MessageEmbed = item.message.embeds[0]
    const isPaused: boolean = (connection.dispatcher && connection.dispatcher.paused) || false

    embed.title = 'test'
    embed.color = isPaused ? 0xb40000 : 0x00d500
    embed.fields[1].value = this._instance.getMessages(this.msgPrefix + '.states.' + (isPaused ? 'paused' : 'running'))

    item.message.edit({ embed }) */
  }

  private async _infoSong (channel: Discord.Channel, connection: UnicornBot.SongConnection, url: string, proposerId: Discord.Snowflake, duration: number = 30000, added: boolean = false): Promise<Discord.Message | Discord.Message[]> {
    const songInfo: ytdl.videoInfo = await ytdl.getInfo(url)
    const index: number = Array.from(connection.queue.keys()).indexOf(url)
    const songElem: UnicornBot.SongData | undefined = connection.queue.get(url)

    const isCurrent: boolean = index === 0
    const isPaused: boolean = (connection.dispatcher && connection.dispatcher.paused) || false
    let data = {
      name: '',
      color: isCurrent ? (isPaused ? 0xb40000 : 0x00d500) : 0xd56a00,
      state: this._instance.getMessages(this.msgPrefix + '.states.' + (isCurrent ? (isPaused ? 'paused' : 'running') : 'waiting'))
    }

    if (added) {
      data.name = this._instance.getMessages(this.msgPrefix + '.play.queued')
    } else if (isCurrent) {
      data.name = this._instance.getMessages(this.msgPrefix + '.play.playing')
    } else if (!!songElem) {
      data.name = this._instance.getMessages(this.msgPrefix + '.play.place')
    } else if (connection.queue.size > 1) {
      data.name = this._instance.getMessages(this.msgPrefix + '.play.queued')
    }

    let startTime: string = ''
    if (/[?&]start=(\d+)/.test(url)) {
      startTime = ' (' + this._instance.getMessages(this.msgPrefix + '.play.startTime').replace('$0', secondToDate(Number(RegExp.$1))) + ')'
    }
    const time = secondToDate(Number(songInfo.length_seconds))

    if (songElem) {
      songElem.data = {
        title: songInfo.title + startTime,
        time,
        proposerId
      }
    }

    return this._instance.send(channel, undefined, new Discord.RichEmbed({
      title: songInfo.title + startTime,
      url: url,
      color: data.color,
      author: {
        name: data.name
      },
      thumbnail: {
        url: songInfo.thumbnail_url
      },
      fields: [{
        name: this._instance.getMessages(this.msgPrefix + '.play.time'),
        value: time
      }, {
        name: this._instance.getMessages(this.msgPrefix + '.play.state'),
        value: data.state
      }, {
        name: this._instance.getMessages(this.msgPrefix + '.play.proposer'),
        value: '<@' + proposerId + '>'
      }],
      footer: {
        text: isCurrent ? '' : this._instance.getMessages(this.msgPrefix + '.play.inQueue').replace('$0', String(index)).replace('$1', String(connection.queue.size - 1))
      }
    }), duration)
  }

  private _processQueue (connection: UnicornBot.SongConnection, message?: Discord.Message) {
    if (connection.queue.size === 0) {
      return
    }

    const voiceConn: Discord.VoiceConnection = connection.connection
    const item: UnicornBot.SongData = connection.queue.values().next().value

    let startTime: number = 0
    if (/[?&]start=(\d+)/.test(item.url)) {
      startTime = Number(RegExp.$1)
    }

    const stream: Readable = ytdl(item.url, {
      filter: 'audioonly',
      requestOptions: {
        'start': startTime
      }
    })
    const dispatcher: Discord.StreamDispatcher = voiceConn.playStream(stream, {
      volume: connection.volume
    })

    stream.on('info', (info: ytdl.videoInfo) => {
      if (message) message.delete().catch((error: Error) => {
        this._instance.reportError('g:' + message.guild.id, error)
      })

      this._infoSong(item.message.channel, connection, item.url, item.message.author.id, (Number(info.length_seconds) * 1000) + 1000).then((message: Discord.Message) => {
        item.message = message
      })
    })
    dispatcher.on('end', () => {
      this._instance.client.setTimeout(() => {
        connection.queue.delete(item.url)
        this._processQueue(connection)
      }, 1500)
    })
    dispatcher.on('error', (...e: any[]) => {
      console.error('dispatcher', ...e)

      e.forEach(err => this._instance.reportError(item.message.guild.id, err))
    })

    connection.dispatcher = dispatcher
  }
}
