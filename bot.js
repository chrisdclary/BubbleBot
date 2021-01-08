
/*************************
 * 		BubbleBot
 * 
 * 	Written by Chris Clary
 * 	
 *	This is a bot I built for fun as an exercise in Node.js and Javascript.
 *	
 *	Currently implemented:
 *	.rps		- plays rock paper scissors
 *		
 *************************/

//	Dependencies, etc.
var auth = require('./auth.json');
var Eris = require('eris');
const bot = new Eris(auth.token);

//	Flag for debug mode. Use .debug to toggle
var debug = 1;

/*************************
 *	Queue construct to serve as a buffer for multiple 
 *		incoming commands
 *************************/ 
class Queue {
	constructor() {
		this.size = 0;
		this.head = null;
		this.tail = null;
	}
	push(node) {
		if(this.size == 0) {
			this.head = node;
			this.tail = node;
		} else {
			this.tail.next = node;
			this.tail = node;
		}
		this.size++;
	}
	pop() {
		if(this.size == 0){
			// Do nothing
		} else {
			this.head = this.head.next;
			this.size -= 1;
			if(this.size == 0){
				this.tail = null;
			}
		}
		return this;
	}
	clear() { 
		this.size = 0;
		this.head = null;
		this.tail = null;
	}
}

//	Initialize command buffer
const commandBuf = new Queue();

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

	if(msg.content.substring(0,1) == '.'){

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
				await bot.createMessage(textChannel, 'Turning debug mode '+str+'.');
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
					console.log('\nCommand Popped:');
					console.log(commandBuf);
				}
				break;

			//	Clear the command buffer
			case 'cmdClear':
				commandBuf.clear();
				if(debug){
					console.log('\nCommand Cleared:');
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
			 *	Add valid commands to the command queue
			 *************************/
			case 'play':
				commandBuf.push(commandNode);
				break;
			
			case 'rps':
				commandBuf.push(commandNode);
				break;

			default:
				await bot.createMessage(textChannel, 'Hello there.');
				break;
		}
		
	} 
});

/*************************
 *	Execute commands in order
 *************************/
async function executeCommands(){
	if(commandBuf.size != 0){ // Only execute a command if the buffer isn't empty
		let current = commandBuf.head;
	
		switch(current.command) {
			case 'play':
				play(current.channel.id);
				commandBuf.pop();
				break;
			case 'rps':
				doJanken(current.channel, current.member, current.member.username);
				commandBuf.pop();
				break;
		}
	}
	
}

//	Serves as a hub for all games
async function play(channelID){
	botmsg = await bot.createMessage(channelID, 
		'What would you like to play?\n:rock: - Rock, Paper, Scissors');
	botmsg.addReaction("🪨");
	botmsg.addReaction("🃏");
}


//	Plays rock, paper, scissors
async function doJanken(channel, member){

	//	Array for handling the mess
	var mess = [];

	//	Target message for evaluation
	let target = await bot.createMessage(channel.id, 
		member.mention+" The rules are simple: type out your choice and hit enter after the countdown.");

	mess.push(target.id);

	//	Randomly assign values to rock, paper, and scissors
	let choice = "";
	let rock = Math.floor(Math.random() * Math.floor(10000));
	let paper = Math.floor(Math.random() * Math.floor(10000));
	let scissors = Math.floor(Math.random() * Math.floor(10000));

	//	Choose the move that got the highest value
	let max = Math.max(rock, paper, scissors);
	if(max == rock) choice = 'Rock';
	else if (max == paper) choice = 'Paper';
	else choice = 'Scissors';

	var temp = '';

	//	Countdown
	setTimeout( async fun => { temp = (await bot.createMessage(channel.id, "3...")).id; } , 3000);
	setTimeout( async fun => { bot.editMessage(channel.id, temp, "2..."); } , 4000);
	setTimeout( async fun => { bot.editMessage(channel.id, temp, "1..."); } , 5000);
	setTimeout( async fun => { bot.editMessage(channel.id, temp, choice +"!").id; }, 6000);
	setTimeout( async fun => { 

		let result = await evaluateJanken(channel, member, target, choice); 

		//	Return the results of the match
		if(result == 0){
			bot.createMessage(channel.id, "Nice job.");
			if(debug) console.log(member.username+" beat the bot.");
		} else if(result == 1){
			bot.createMessage(channel.id, "I won! Better luck next time.");
			if(debug) console.log("The bot beat "+member.username);
		} else if(result == 2){
			bot.createMessage(channel.id, "So it's a tie, huh. Lame.");
			if(debug) console.log("There was a tie between the bot and "+member.username);
		} else if(result == 3){
			//	Don't do anything if they messed up
			if(debug) console.log(member.username+" did something wrong.");
		}

		//	Once command has finished, clean up the mess
		setTimeout(() => {
			if(debug) console.log("Cleaning mess: " +mess);
			bot.deleteMessages(channel.id, mess); 
			mess = [];
		}, 15000);

	}, 6500);

}


/*************************
 * Helper functions for Janken
 *************************/

 //	Read the last message send 
async function evaluateJanken(channel, member, target, choice){
	//	Number of messages to read back
	var limit = 30;
	//	Player's move
	var response = '';

	//	Get array of messages posted since the game started
	let lastMsg = await channel.getMessages(limit, null, target.id);
	for(let i = 0; i < lastMsg.length; i++){
		//	Find the most recent message from the player
		if(lastMsg[i].author.id == member.id){
			response = lastMsg[i].content;
			break;
		}
	}
	// Convert player response into a gesture
	let playerGesture = convertJanken(response);

	//	Player never responded :(
	if(response == ''){ 
		bot.createMessage(channel.id, "Don't leave me hanging!");
		return 3; //	Return No Contest
	}  

	//	Player responded with something weird
	if(playerGesture == 0){
		bot.createMessage(channel.id, "What's that supposed to be?");
		return 3; //	Return No Contest
	}

	//	Player made a valid gesture -> see who won
	return whoWon(convertJanken(choice), playerGesture); 
}


/*************************
 * Take in a janken gesture and evaluate it
 * 
 * Returns:
 * 0 = invalid
 * 1 = rock
 * 2 = paper
 * 3 = scissors
 *************************/
function convertJanken(input){

	//	Tokenize the player's response
	var tokenize = input.substring(0).split(' ');

	if(debug) console.log(tokenize);

	//	If the player sent a bunch of stuff, only evalu
	input = tokenize[tokenize.length-1].toLowerCase();
	switch(input.charAt(0)){
		case 'r':
			return 1;
		case 'p':
			return 2;
		case 's':
			return 3;
		default:
			return 0;
	}
}


/*************************
 * Return winner. 
 * 0 = player win
 * 1 = bot win
 * 2 = tie
 *************************/
function whoWon(bot, player){

	//	If both did the same gesture, return a tie
	if (bot == player)
		return 2; 

	//	If they threw different gestures, see who won
	if(bot == 1){ //	Bot threw rock
		if(player == 2)
			return 0;
		else
			return 1;
	}
	else if(bot == 2){ //	Bot threw paper
		if(player == 3)
			return 0;
		else
			return 1;
	}
	else { //	Bot threw scissors
		if(player == 1)
			return 0;
		else
			return 1;
	}
	
}



bot.connect();
