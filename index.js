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
        model: '',
        prefix: '',
        'pit-emoji': {
            name: '',
            id: ''
        },
        'pit-question-emoji': {
            name: '',
            id: ''
        }
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
            messageChannels: [],
            pitChannels: [],
            emojiOrder: {}
        }).write();
    
        function inMessageChannel(msg)
        {
            return db.get('messageChannels').value().indexOf(msg.channel.id) !== -1;
        }
    
        function inPitChannel(msg)
        {
            return db.get('pitChannels').value().indexOf(msg.channel.id) !== -1;
        }
        
        async function botRespond(msg)
        {
            logger.info(`[${msg.channel.name}] ${msg.member.displayName} > ${msg.content}`);
            waitingForResponse = true;
            msg.channel.startTyping();
            const response = await chat.send(msg.content, msg.channel.name);
            msg.channel.stopTyping();
            waitingForResponse = false;
            logger.info(`[${msg.channel.name}] Bot > ${response}`);
            msg.channel.send(response);
        }
        
        let waitingForResponse = false;
        let previousReaction = null;
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
            if(msg.content === config.prefix + 'toggle-msg' && msg.member.id !== client.user.id)
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
            else if(msg.content === config.prefix + 'toggle-pit' && msg.member.id !== client.user.id)
            {
                if(msg.channel.type === 'text')
                {
                    if(msg.guild.owner.id !== msg.member.id)
                    {
                        msg.reply('Sorry, you must be the owner of this server to do that!');
                        return;
                    }
                }
        
                if(!inPitChannel(msg))
                {
                    db.get('pitChannels').push(msg.channel.id).write();
                    db.get('emojiOrder').set(msg.channel.id, []).write();
                    logger.info(`Added pit channel - ${msg.channel.name}`);
                    msg.reply('Added pit channel');
                }
                else
                {
                    db.get('pitChannels').pull(msg.channel.id).write();
                    db.get('emojiOrder').unset(msg.channel.id).write();
                    logger.info(`Removed pit channel - ${msg.channel.name}`);
                    msg.reply('Removed pit channel');
                }
            }
            else if(inMessageChannel(msg) && msg.content && msg.content.length > 0 && msg.member.id !== client.user.id)
            {
                if(!waitingForResponse)
                {
                    botRespond(msg);
                }
            }
            else if(inPitChannel(msg) && msg.content && msg.content.length > 0)
            {
                if(previousReaction !== null)
                {
                    // Remove own reactions from previous message
                    previousReaction.reactions.cache.array().filter(r => r.me).forEach(r => r.remove());
                    previousReaction = null;
                }
                if(msg.content === '[pit-sync]' && msg.member.id !== client.user.id)
                {
                    // Sync reactions in pit so the order stays consistent
                    logger.info(`Running pit sync in ${msg.channel.name}`);
                    msg.react(config['pit-emoji'].id);
                    previousReaction = msg;
                    setTimeout(() =>
                    {
                        const reactions = msg.reactions.cache.array().map(r => r.emoji);
                        const sorted = reactions.map(e => e.name).sort();
                        logger.info(`Sorted: ${JSON.stringify(sorted)}`);
                        db.get('emojiOrder').set(msg.channel.id, sorted).write();
                    }, 2000);
                }
                else
                {
                    const order = db.get('emojiOrder').get(msg.channel.id).value();
                    if(order.length === 0)
                    {
                        return;
                    }
                    if(order[0] === config['pit-emoji'].name)
                    {
                        setTimeout(() =>
                        {
                            previousReaction = msg;
                            msg.react(config['pit-emoji'].id);
                        }, 250);
                    }
                    else
                    {
                        const before = order[order.indexOf(config['pit-emoji'].name) - 1];
                        const filter = r => r.emoji.name === before;
                        const collector = msg.createReactionCollector(filter, {time: 2000});
                        collector.on('collect', r =>
                        {
                            previousReaction = msg;
                            msg.react(config['pit-emoji'].id).then(() =>
                            {
                                // If it's the last in the order, respond with the question
                                if(order.indexOf(config['pit-emoji'].name) === order.length - 1)
                                {
                                    msg.react(config['pit-question-emoji'].id);
                                }
                            });
                        });
                        collector.on('end', collected =>
                        {
                            if(collected.size === 0)
                            {
                                logger.warn('Did not collect reaction in time');
                            }
                        });
                    }
                }
            }
        });
        
        client.on('messageReactionAdd', async (reaction, user) =>
        {
            if(reaction.partial)
            {
                try
                {
                    await reaction.fetch();
                }
                catch(e)
                {
                    logger.error('Error fetching partial reaction: ', e);
                    return;
                }
            }
            const msg = reaction.message;
            if(!inPitChannel(msg) || msg.content === '[pit-sync]' || reaction.count === 1)
            {
                return;
            }
            
            if(reaction.emoji.name === config['pit-emoji'].name)
            {
                reaction.remove();
                if(waitingForResponse)
                {
                    return;
                }
                botRespond(msg);
            }
            else if(reaction.emoji.name === config['pit-question-emoji'].name)
            {
                reaction.remove();
                if(waitingForResponse)
                {
                    return;
                }
                
            }
        });
    });
}).catch(e =>
{
});
