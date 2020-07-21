const {spawn} = require('child_process');
const EventEmitter = require('events');

class GPT2Chat extends EventEmitter
{
    constructor(modelName, logger)
    {
        super();
        this.logger = logger;
        this.conversation = ['subject: hello'];
        this.shell = spawn('python', ['gpt-2/chat.py', `--model_name=${modelName}`, `--seed=${Math.round(Math.random() * 100000)}`]);
    
        let chatFlag = false;
        let first = true;
        this.shell.stdout.on('data', data =>
        {
            const strData = data.toString();
            if(first)
            {
                logger.info(`data: ${strData}`);
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
            this.conversation.push(`other: ${message}`);
            if(this.conversation.length > 5)
            {
                this.conversation.shift();
            }
            this.shell.stdin.write(Buffer.from(this.conversation.join('\n') + '\nsubject: ')
                                          .toString('base64') + "\n");
            this.once('message', response =>
            {
                const responseStr = Buffer.from(response, 'base64').toString();
                this.conversation.push(`subject: ${responseStr}`);
                if(this.conversation.length > 5)
                {
                    this.conversation.shift();
                }
                resolve(responseStr);
            });
        });
    }
}

module.exports = GPT2Chat;
