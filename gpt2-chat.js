const {spawn} = require('child_process');
const EventEmitter = require('events');

class GPT2Chat extends EventEmitter
{
    constructor(modelName, logger)
    {
        super();
        this.shell = spawn('python', ['gpt-2/chat.py', `--model_name=${modelName}`]);
    
        let chatFlag = false;
        let first = true;
        this.shell.stdout.on('data', data =>
        {
            const strData = data.toString();
            if(first)
            {
                logger.info(strData);
            }
            if(chatFlag)
            {
                chatFlag = false;
                this.emit('message', strData.trim());
            }
            else if(strData.endsWith('other: '))
            {
                if(first)
                {
                    first = false;
                    this.emit('ready');
                }
            }
            else if(strData === 'subject: ')
            {
                chatFlag = true;
            }
        });
        this.shell.stderr.on('data', chunk =>
        {
            logger.warn(chunk.toString());
        });
    }
    
    send(message)
    {
        return new Promise(resolve =>
        {
            this.shell.stdin.write(message + "\n");
            this.once('message', message =>
            {
                resolve(message);
            });
        });
    }
}

module.exports = GPT2Chat;
