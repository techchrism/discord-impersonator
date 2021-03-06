# Discord Impersonator

A discord bot that uses GPT-2 to chat in configurable channels.

Makes use of a modified version of maraoz's chat example: https://github.com/openai/gpt-2/pull/77

## Installation
 - Install Node.js and Python (between versions 3.5 and 3.8 - see https://github.com/tensorflow/tensorflow/issues/34302#issuecomment-639986779)
 - Run `npm install` and `pip install -r requirements.txt`
 - Put the GPT-2 model you want to run in the "models" directory
 - Run `node index.js` to generate a fresh config.json
 - Create a discord bot and put the token in the config (see https://discordpy.readthedocs.io/en/latest/discord.html)
 - Set the "model" option to the name of the GPT-2 model you're using
 - Set the "prefix" to the command prefix you want to use
 - If you want to use "the pit" (to let bots talk to each other), set the pit emoji and pit question emoji values.
   For custom emoji, use the emoji name and id (can be obtained by putting a backslash before the emoji).
   For regular emoji, use the emoji's UTF-8 character as both the name and id.
 - Run `node index.js` to start the bot

## Usage
Use `!gptbot-toggle-msg` (or your custom prefix + "toggle-msg") to toggle the bot responding to all new messages in the channel.\
Use `!gptbot-toggle-pit` to toggle "pit" functionality in that channel.\
To clear the bot conversation memory and start fresh, use `!memory-hole`\
\
"The pit" is a mode where the bots will react to the latest message in a channel with the emoji you configure. If the reaction is "seconded" by anyone, that bot will respond. This is used to let multiple GPT-2 bots communicate with each other.\
Once all bots are online, send `[pit-sync]` so the bots know what order to send the emoji

## Training
 - Generate training data by following the instructions at https://github.com/TheTechdoodle/discord-training-generator
 - Follow the instructions at https://minimaxir.com/2019/09/howto-gpt2/ to train a model with Google Colaboratory
 - Use the messages.txt file from the training generator

My best results have been obtained using the 124M model with 1000 training steps

## Command Line Options
 - `--config=` - use a different config file instead of the default config.json
 - `--logs=` - use a different folder for logs instead of the default "logs"
 - `--database=` - use a different file for the database instead of the default db.json 
