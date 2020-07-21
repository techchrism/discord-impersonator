const fs = require('fs').promises;
const Discord = require('discord.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const {createLogger, format, transports} = require('winston');
const {combine, timestamp, printf} = format;
require('winston-daily-rotate-file');
const GPT2Chat = require('./gpt2-chat.js');
const {argv} = require('yargs').option('config', {
    alias: 'c',
    type: 'string',
    description: 'The path of the config.json file to use'
}).option('logs', {
    alias: 'l',
    type: 'string',
    description: 'The path of the directory to use for logging'
}).option('database', {
    alias: 'd',
    type: 'string',
    description: 'The path of the db.json file to use'
});

// Begin logging
const fileTransport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    dirname: argv.logs || 'logs'
});
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
const logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    transports: [
        new transports.Console(),
        fileTransport
    ]
});

async function writeDefaultConfig()
{
    return fs.writeFile(argv.config || 'config.json', JSON.stringify({
        token: '',
        model: ''
    }, null, 4));
}

async function loadConfig()
{
    let fileText = '';
    try
    {
        fileText = await fs.readFile(argv.config || 'config.json', 'utf8');
    }
    catch(e)
    {
        logger.error('Config file not found! Creating default config...');
        await writeDefaultConfig();
        throw e;
    }
    
    try
    {
        return JSON.parse(fileText);
    }
    catch(e)
    {
        const newName = `config-broken-${Date.now()}.json`;
        logger.error(`Could not parse config! Moved to ${newName}`);
        await fs.rename(argv.config || 'config.json', newName);
        await writeDefaultConfig();
        throw e;
    }
}

loadConfig().then(config =>
{
    logger.info('Loaded config');
    logger.info(`Loading model ${config.model}`);
    const chat = new GPT2Chat(config.model, logger);
    chat.on('ready', () =>
    {
        logger.info('Chat ready');
        const adapter = new FileSync(argv.database || 'db.json');
        const db = low(adapter);
    
        db.defaults({
            messageChannels: []
        }).write();
    
        function inMessageChannel(msg)
        {
            return db.get('messageChannels').value().indexOf(msg.channel.id) !== -1;
        }
        
        let waitingForResponse = false;
        let client = new Discord.Client();
        client.login(config.token).then(r => logger.info('Logged in successfully')).catch(e =>
        {
            logger.error('Error logging in');
            logger.error(e);
        });
        client.on('shardError', error =>
        {
            logger.error('Websocket error', error);
        });
        process.on('unhandledRejection', error =>
        {
            logger.error('Unhandled promise rejection:', error);
        });
        client.on('ready', () =>
        {
            logger.info(`Logged in as ${client.user.tag}!`);
        });
        client.on('message', async msg =>
        {
            if(msg.member.id === client.user.id)
            {
                return;
            }
    
            if(msg.content === config.prefix + 'toggle')
            {
                if(msg.channel.type === 'text')
                {
                    if(msg.guild.owner.id !== msg.member.id)
                    {
                        msg.reply('Sorry, you must be the owner of this server to do that!');
                        return;
                    }
                }
        
                if(!inMessageChannel(msg))
                {
                    db.get('messageChannels').push(msg.channel.id).write();
                    logger.info(`Added message channel - ${msg.channel.name}`);
                    msg.reply('Hello');
                }
                else
                {
                    db.get('messageChannels').pull(msg.channel.id).write();
                    logger.info(`Removed message channel - ${msg.channel.name}`);
                    msg.reply('Goodbye');
                }
            }
            else if(inMessageChannel(msg) && msg.content && msg.content.length > 0)
            {
                if(!waitingForResponse)
                {
                    logger.info(`${msg.member.displayName} > ${msg.content}`);
                    waitingForResponse = true;
                    msg.channel.startTyping();
                    const response = await chat.send(msg.content);
                    msg.channel.stopTyping();
                    waitingForResponse = false;
                    logger.info(`Bot > ${response}`);
                    msg.channel.send(response);
                }
            }
        });
    });
}).catch(e =>
{
});
