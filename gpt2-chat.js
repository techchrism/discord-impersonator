const {spawn} = require('child_process');
const EventEmitter = require('events');

class GPT2Chat extends EventEmitter
{
    constructor(modelName, logger)
    {
        super();
        this.conversations = {};
        this.conversationLength = 10;
        this.shell = spawn('python', ['gpt-2/chat.py', `--model_name=${modelName}`,`--seed=${Math.round(Math.random() * 100000)}`]);
    
        let chatFlag = false;
        let first = true;
        this.shell.stdout.on('data', data =>
        {
            const strData = data.toString();
            if(first)
            {
                // If the script is still starting, log stdout
                logger.info(strData);
            }
            if(chatFlag)
            {
                chatFlag = false;
                this.emit('message', strData.trim());
            }
            else if(strData.endsWith('other: '))
            {
                // Use the first occurrence of the "other: " string to check when the script has started
                if(first)
                {
                    first = false;
                    this.emit('ready');
                }
            }
            else if(strData === 'subject: ')
            {
                // Flag that indicates the next output will be bot chat
                chatFlag = true;
            }
        });
        this.shell.stderr.on('data', chunk =>
        {
            logger.warn(chunk.toString());
        });
    }
    
    send(message, key, ignoreAdd)
    {
        return new Promise(resolve =>
        {
            if(message === '!memory-hole')
            {
                this.conversations[key] = [];
                resolve('Sorry, what were we talking about?');
                return;
            }
            
            if(!ignoreAdd)
            {
                this.addToConversation(message, key);
            }
            
            // Write the base64 encoded conversation with the "subject: " prompt
            this.shell.stdin.write(Buffer.from(this.conversations[key].join('\n') + '\nsubject: ')
                                          .toString('base64') + "\n");
            
            // When a message is received, decode it, add it to the conversation, and resolve the promise
            this.once('message', response =>
            {
                const responseStr = Buffer.from(response, 'base64').toString();
                this.conversations[key].push(`subject: ${responseStr}`);
                resolve(responseStr);
            });
        });
    }
    
    addToConversation(message, key)
    {
        // Get the conversation for the given key or create one if it doesn't exist
        if(!key)
        {
            key = 'no-key';
        }
        if(!this.conversations.hasOwnProperty(key))
        {
            this.conversations[key] = ['subject: hello'];
        }
    
        // Add this message to the conversation and trim the conversation if it's too long
        this.conversations[key].push(`other: ${message}`);
        while(this.conversations[key].length > this.conversationLength)
        {
            this.conversations[key].shift();
        }
    }
}

module.exports = GPT2Chat;
