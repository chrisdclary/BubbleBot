
/*************************
 * 		BubbleBot
 * 
 * 	Written by Chris Clary
 * 	
 *	This is a bot I built for fun as an exercise in Node.js and Javascript.
 *	
 *	Currently, you can play rock paper scissors (janken) with the bot, and
 *  	and bet money on a positive outcome
 *		
 *************************/

//	Dependencies, etc.
const { List } = require("./List");
const { bot, db } = require("./connection");
const { debug, busyList, busyPop} = require("./global");
const { doJanken, winRate } = require("./janken");
const { showMoney, borrow, repay } = require("./money");

//	Initialize command buffer
const commandBuf = new List();

// 	Execute a command from the buffer every few seconds
setInterval(executeCommands, 500);

bot.on("ready", () => {
	console.log("Ready!");
});

/************************* 
 * 	Main event listener, evaluates messages and adds commands
 *		to the command buffer
 *************************/
bot.on("messageCreate", async msg =>{

	var lowercasemsg = msg.content.toLowerCase();

	if(msg.content.substring(0,1) == '.' && msg.member.id != bot.user.id){

		db.serialize(() => {
			//	create user table if it doesn't exist
			db.run(`CREATE TABLE IF NOT EXISTS 
						users (userID TEXT PRIMARY KEY, wins INT, losses INT, rock INT, paper INT, scissors INT, cash INT, debt INT)`, function (err){
				if(err){
					if(debug) console.log(`error making table: ${err.message}`); 
				} 

			});	

			//	add row for the user if it doesn't already exist
			db.run(`INSERT INTO users VALUES(${msg.author.id}, 0, 0, 0, 0, 0, 500, 0)`, function (err){
				if(err){
					//	Do nothing, user is probably already in the table
					if(debug) console.log(`Error adding row: ${err.message}`);
				}
				else {
					if (debug) console.log(`A row has been inserted for ${msg.member.username}`);
				}
			});
		});
		

		//	Parse command
		var args = msg.content.substring(1).split(' ');
		var cmd = args[0];
		var textChannel = msg.channel.id;
		args = args.splice(1);

		//	Node for our command buffer
		let commandNode = {
			command: cmd,
			args: args,
			member: msg.member,
			channel: msg.channel,
			next: null
		};

		switch(cmd){

			/*************************
			 *	Deal with admin commands immediately, don't add them to the buffer
			 *************************/
			//	Toggle debug mode
			case 'debug':
				debug = !debug;
				var str = '';
				if(debug)
					str = "on";
				else
					str = "off";
				await bot.createMessage(textChannel, `Turning debug mode ${str}.`);
				break;

			//	Force bot to leave the user's voice channel
			case 'leave':
				var voiceChannel = msg.member.voiceState;
				if(debug) console.log(voiceChannel);

				if(voiceChannel.channelID != null){
					bot.leaveVoiceChannel(voiceChannel.channelID);
				}
				break;

			//	Pop top command from the buffer
			case 'cmdPop':
				commandBuf.pop();
				if(debug){
					console.log('Command Popped:');
					console.log(commandBuf);
				}
				break;

			//	Clear the command buffer
			case 'cmdClear':
				commandBuf.clear();
				if(debug){
					console.log('Command Cleared:');
					console.log(commandBuf);
				}
				break;
			
			//	View the current command queue
			case 'viewQueue':
				if(debug){
					console.log(commandBuf);
				}
				break;

			/*************************
			 *	Add regular commands to the command queue to be parsed later
			 *************************/	

			default:
				commandBuf.append(commandNode);
				break;
		}

	}
	 else if (lowercasemsg.includes("save")&&lowercasemsg.includes("day")||lowercasemsg.includes("true")
	 ||lowercasemsg.includes("truth")){
		saveTheDay(msg, msg.channel.id, msg.member);
	}
	
});

/*************************
 *	Execute commands in order
 *************************/
async function executeCommands(){
	if(commandBuf.size != 0){ // Only execute a command if the buffer isn't empty
		let current = commandBuf.head;

		if(busyList.includes(current.channel.id)){ //	If channel is busy, ignore command
			if(debug) console.log("Ignoring command");
			commandBuf.pop();
		}
		else{
			switch(current.command) {
				case 'play':
					play(current.channel.id);
					commandBuf.pop();
					break;
				case 'rps':
					busyList.push(current.channel.id);
					doJanken(current.channel, current.member, current.args);
					commandBuf.pop();
					break;
				case 'wr':
					winRate(current.channel, current.member);
					commandBuf.pop();
					break;
				case 'money':
					showMoney(current.channel, current.member);
					commandBuf.pop();
					break;
				case 'help':
					showHelp(current.channel, current.args);
					commandBuf.pop();
					break;
				case 'borrow':
					borrow(current.channel, current.member, current.args);
					commandBuf.pop();
					break;
				case 'repay':
					repay(current.channel, current.member, current.args);
					commandBuf.pop();
					break;
				default:
					bot.createMessage(current.channel.id, `I don't know that command.`);
					commandBuf.pop();
					break;
			}
		}	
	}
}

async function showHelp(channel, args){
	//	Show different info based on what the main command is
	if(debug) console.log(args[0]);
	switch(args[0]){
		case undefined:
			bot.createMessage(channel.id, "Available commands:\n"+ 
				".rps -- Play Rock, Paper, Scissors\n"+
				".wr -- Show rps winrate\n"+
				".money -- Show current cash & debt\n"+
				".borrow <amount>-- Borrow some money\n"+
				".repay <amount>-- Repay your debt\n"+
				".leave -- Force me to leave the voice channel\n"+
				"----------\n"+
				"Run command with options by adding the options after the command, separated by spaces\n"+
				"Syntax: .<cmd> <options>\n"+
				"----------\n"+
				"For help with a specific command, type \".help <commandname>\"");
			break;
		case 'rps':
			bot.createMessage(channel.id, "Options:\n"+
				".rps <amount> -- Wager some of your cash on this match\n"+
				"		Double your wager on a win, lose it all on a loss.");
			break;
	}
}
//	Serves as a hub for all games
async function play(channelID){
	botmsg = await bot.createMessage(channelID, 
		'What would you like to play?\n:rock: - Rock, Paper, Scissors');
	botmsg.addReaction('🪨');
}

//	Ktrue saves the day
async function saveTheDay(msg, channelID, member){

	var voiceChannel = member.voiceState.channelID;
	if(debug) console.log(voiceChannel);

	if(voiceChannel != null){
		bot.createMessage(channelID, 'Calling Ktrue...');
		var connection = await bot.joinVoiceChannel(voiceChannel);
		connection.play('ktrue.mp3');
		connection.on('end', () => {
			bot.leaveVoiceChannel(voiceChannel);
			bot.createMessage(channelID, 'The day has been saved.');
		});
	} else {
		msg.addReaction('🇰');
		msg.addReaction('🇹');
		msg.addReaction('🇷');
		msg.addReaction('🇺');
		msg.addReaction('🇪');
	}
}

bot.connect();
