const { bot, db } = require("./connection");
const { busyPop, debug } = require("./global");

//	Plays rock, paper, scissors

async function doJanken(channel, member, args) {

	var gestureCounts = [];
	var wager = 0;

	if (args[0] != undefined) { //	Check for options

		var option = parseInt(args[0]);
		if (debug)
			console.log(`Option: ${option}`);

		if (Number.isInteger(option)) { //	If there is a wager, make sure it is an int
			if (option < 0) { //	Players can't wager negative money
				bot.createMessage(channel.id, "Nice try, fucker");
				busyPop(channel);
				return;
			}
			db.serialize(() => {
				//	
				db.get(`SELECT cash cash FROM users WHERE userID = ${member.user.id}`, (err, row) => {
					if (err)
						console.log(`error querying table: ${err.message}`);
					else {
						if (debug)
							console.log(`Player's cash: ${row.cash}`);
						if (option > row.cash) { //	Make sure they don't wager more than they have
							bot.createMessage(channel.id, "You don't have enough money.");
							busyPop(channel);
							return;
						}
						else {
							wager = option;
						}
					}
				});
			});
		}
		else { //	Anything other than an integer throws an error
			bot.createMessage(channel.id, "Invalid option");
			busyPop(channel);
			return;
		}
	}

	/******************************
	 * 	Value modifiers -
	 * 	Analyze the player's tendencies towards rock/paper/scissors
	 * 		and prefer gesture that beats their tendency
	 ******************************/
	db.serialize(() => {
		//	
		db.get(`SELECT rock roc, paper pap, scissors sci FROM users WHERE userID = ${member.user.id}`, (err, row) => {
			if (err)
				console.log(`error querying table: ${err.message}`);
			else {
				//if(debug) console.log(`rock: ${row.roc} paper: ${row.pap} scissors: ${row.sci}`);
				let total = 0;
				gestureCounts.push(row.roc);
				total += row.roc;
				gestureCounts.push(row.pap);
				total += row.pap;
				gestureCounts.push(row.sci);
				total += row.sci;
				let choice = chooseGesture(gestureCounts, total);
				if (debug)
					console.log(`Wager: ${wager}`);
				runJanken(choice, channel, member, wager);
			}
		});
	});
}

exports.doJanken = doJanken;

/*
 *
 *	Start Janken Helper functions
 *
 */

async function runJanken(choice, channel, member, wager) {

	//	Target message for evaluation
	var target = await bot.createMessage(channel.id,
		member.mention + " The rules are simple: type out your choice before the countdown ends.");

	//mess.push(target.id);
	//	var temp = '';
	//	Countdown
	setTimeout(async (fun) => { bot.editMessage(channel.id, target.id, "3..."); }, 3000);
	setTimeout(async (fun) => { bot.editMessage(channel.id, target.id, "2..."); }, 4000);
	setTimeout(async (fun) => { bot.editMessage(channel.id, target.id, "1..."); }, 5000);
	setTimeout(async (fun) => { bot.editMessage(channel.id, target.id, choice + "!"); }, 6000);
	setTimeout(async (fun) => {

		let result = await evaluateJanken(channel, member, target, choice);

		//	Return the results of the match
		if (result == 0) {
			db.serialize(() => {
				//	Update player row with new win/loss
				db.run(`UPDATE users SET wins = wins + 1 WHERE userID = ${member.user.id}`, function (err) {
					if (err)
						console.log(`error updating table: ${err.message}`);
				});
				if (wager != 0) {
					db.run(`UPDATE users SET cash = cash + ${wager} WHERE userID = ${member.user.id}`, function (err) {
						if (err)
							console.log(`error paying wager: ${err.message}`);
					});
				}
			});
			if (wager != 0) {
				await bot.createMessage(channel.id, `Nice job. You gained \$${wager}`);
				if (debug)
					console.log(`${member.username} beat the bot and gained \$${wager}.`);
			}
			else {
				await bot.createMessage(channel.id, "Nice job.");
				if (debug)
					console.log(member.username + " beat the bot.");
			}

		}

		else if (result == 1) {
			db.serialize(() => {
				//	Update player row with new win/loss
				db.run(`UPDATE users SET losses = losses + 1 WHERE userID = ${member.user.id}`, function (err) {
					if (err)
						console.log(`error updating table: ${err.message}`);
				});
				if (wager != 0) {
					db.run(`UPDATE users SET cash = cash - ${wager} WHERE userID = ${member.user.id}`, function (err) {
						if (err)
							console.log(`error paying wager: ${err.message}`);
					});
				}
			});
			if (wager != 0) {
				await bot.createMessage(channel.id, `I won! Better luck next time. You lost \$${wager}`);
				if (debug)
					console.log(`The bot beat ${member.username} and they lost \$${wager}.`);
			}
			else {
				bot.createMessage(channel.id, "I won! Better luck next time.");
				if (debug)
					console.log(`The bot beat ${member.username}`);
			}
		}

		else if (result == 2) {
			bot.createMessage(channel.id, "So it's a tie, huh. Lame.");
			if (debug)
				console.log(`There was a tie between the bot and ${member.username}`);
		}

		else if (result == 3) {
			//	Don't do anything if they messed up
			if (debug)
				console.log(`${member.username} did something wrong.`);
		}

		busyPop(channel);

	}, 6500);
}

//  Determines which gesture the bot will throw
function chooseGesture(values, total) {

	let rockMod = 5 * (values[2] / total);
	let papMod = 5 * (values[0] / total);
	let scisMod = 5 * (values[1] / total);

	let rock = (Math.floor(Math.random() * Math.floor((1 + rockMod) * 10000)));
	let paper = (Math.floor(Math.random() * Math.floor((1 + papMod) * 10000)));
	let scissors = (Math.floor(Math.random() * Math.floor((1 + scisMod) * 10000)));

	//	Choose the move that got the highest value
	let max = Math.max(rock, paper, scissors);
	if (max == rock)
		return 'Rock';
	else if (max == paper)
		return 'Paper';
	else
		return 'Scissors';
}

//  Ealuates player and bot's choices
async function evaluateJanken(channel, member, target, choice) {
	//	Number of messages to read back
	var limit = 30;
	//	Player's move
	var response = '';

	//	Get array of messages posted since the game started
	let lastMsg = await channel.getMessages(limit, null, target.id);
	for (let i = 0; i < lastMsg.length; i++) {
		//	Find the most recent message from the player
		if (lastMsg[i].author.id == member.id) {
			response = lastMsg[i].content;
			break;
		}
	}
	// Convert player response into a gesture
	let playerGesture = convertJanken(response);

	//	Player never responded :(
	if (response == '') {
		bot.createMessage(channel.id, "Don't leave me hanging!");
		return 3; //	Return No Contest
	}

	//	Player responded with something weird
	if (playerGesture == 0) {
		bot.createMessage(channel.id, "What's that supposed to be?");
		return 3; //	Return No Contest
	}

	//	Player's valid gesture will be added to the database
	db.serialize(() => {
		if (playerGesture == 1) {
			//	Player throws rock, increment rock count
			db.run(`UPDATE users SET rock = rock + 1 WHERE userID = ${member.user.id}`, function (err) {
				if (err)
					console.log(`error updating table: ${err.message}`);
			});
		}
		else if (playerGesture == 2) {
			//	Player throws paper, increment paper count
			db.run(`UPDATE users SET paper = paper + 1 WHERE userID = ${member.user.id}`, function (err) {
				if (err)
					console.log(`error updating table: ${err.message}`);
			});
		}
		else {
			//	Player throws scissors, increment scissors count
			db.run(`UPDATE users SET scissors = scissors + 1 WHERE userID = ${member.user.id}`, function (err) {
				if (err)
					console.log(`error updating table: ${err.message}`);
			});
		}
	});

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
function convertJanken(input) {

	//	Tokenize the player's response
	var tokenize = input.substring(0).split(' ');

	if (debug)
		console.log(tokenize);

	//	If the player sent a bunch of stuff, only evalu
	input = tokenize[tokenize.length - 1].toLowerCase();
	switch (input.charAt(0)) {
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
function whoWon(bot, player) {

	//	If both did the same gesture, return a tie
	if (bot == player)
		return 2;

	//	If they threw different gestures, see who won
	if (bot == 1) { //	Bot threw rock
		if (player == 2)
			return 0;

		else
			return 1;
	}
	else if (bot == 2) { //	Bot threw paper
		if (player == 3)
			return 0;

		else
			return 1;
	}
	else { //	Bot threw scissors
		if (player == 1)
			return 0;

		else
			return 1;
	}

}

//	Print player's winrate
async function winRate(channel, member) {
	db.serialize(() => {
		//	Show player their winrate
		db.get(`SELECT wins win, losses loss FROM users WHERE userID = ${member.user.id}`, (err, row) => {
			if (err) {
				if (debug)
					console.log(`error querying table: ${err.message}`);
			}

			else
				bot.createMessage(channel.id, `${member.mention} ${row.win} wins ${row.loss} losses`);
		});
	});
}
exports.winRate = winRate;
