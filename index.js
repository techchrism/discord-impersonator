const fs = require('fs').promises;

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
        console.error('Config file not found! Creating default config...');
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
        console.error(`Could not parse config! Moved to ${newName}`);
        await fs.rename('config.json', newName);
        await writeDefaultConfig();
        throw e;
    }
}

loadConfig().then(config =>
{
    console.log('Parsed config');
    console.log(config);
}).catch(e =>
{

});
