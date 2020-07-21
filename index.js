const fs = require('fs').promises;
const Discord = require('discord.js');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const {createLogger, format, transports} = require('winston');
const {combine, timestamp, printf} = format;
require('winston-daily-rotate-file');

// Begin logging
const fileTransport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    dirname: 'logs'
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
    return fs.writeFile('config.json', JSON.stringify({
        token: ''
    }, null, 4));
}

async function loadConfig()
{
    let fileText = '';
    try
    {
        fileText = await fs.readFile('config.json', 'utf8');
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
        await fs.rename('config.json', newName);
        await writeDefaultConfig();
        throw e;
    }
}

loadConfig().then(config =>
{
    logger.info('Loaded config');
    const adapter = new FileSync('db.json');
    const db = low(adapter);
    
    
    
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
    
}).catch(e =>
{
});
