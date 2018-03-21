import * as Discord from 'discord.js'

declare namespace UnicornBot {
  export interface SongData {
    url: string,
    message: Discord.Message,

    data?: {
      title: string,
      time: string,
      proposerId: Discord.Snowflake
    }
  }

  export interface SongConnection {
    connection: Discord.VoiceConnection
    speakings: Discord.User[]
    dispatcher?: Discord.StreamDispatcher
    volume: number
    reducedVolume: boolean
    queue: Map<string, SongData>
  }

  export interface Command {
    readonly initialized: boolean

    description: string
    aliases: string[]
    usage: string
    usages: Map<string, { command: string, description: string }>
    msgPrefix: string
    needPermission: Discord.PermissionResolvable | false

    init (): void

    shutdown (): Promise<void>

    execute (message: Discord.Message, args: string[]): void
  }
}

declare interface UnicornBot {
  readonly client: Discord.Client
  readonly commands: UnicornBot.Command[]

  shutdown (): Promise<void>

  registerCommand (command: string | UnicornBot.Command): void

  send (channel: Discord.Channel, message?: Discord.StringResolvable, options?: Discord.MessageOptions | Discord.RichEmbed | Discord.Attachment, duration?: number): Promise<Discord.Message | Discord.Message[]>

  reply (message: Discord.Message, reply?: Discord.StringResolvable, options?: Discord.MessageOptions, remove?: boolean, duration?: number): Promise<Discord.Message | Discord.Message[]>

  reportError (guild: Discord.Snowflake, error: Error): void

  getMessages (path: string): string
}

declare module 'unicorn-bot' {
  export = UnicornBot
}

declare global {
  namespace NodeJS {
    interface Global {
      isDev: boolean
      verbose: boolean
    }
  }
}
