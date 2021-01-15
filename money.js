const { bot, db } = require("./connection");
const { debug } = require("./global");

/********************
 * 	Money Commands
 ********************/
//	Show player how much money they have
async function showMoney(channel, member) {

	db.serialize(() => {
		db.get(`SELECT cash cash, debt debt FROM users WHERE userID = ${member.user.id}`, (err, row) => {
			if (err) {
				if (debug)
					console.log(`error querying table: ${err.message}`);
			}

			else
				bot.createMessage(channel.id, `${member.mention} You have
$${row.cash} in cash and $${row.debt} in debt.`);

		});
	});
}
exports.showMoney = showMoney;
// 	Borrow cash

async function borrow(channel, member, args) {
	switch (args[0]) {
		case undefined:
			bot.createMessage(channel.id, "You gotta say how much you want\nSyntax: .borrow <amount>");
			break;
		default:
			var amount = parseInt(args[0]);
			if (debug)
				console.log(`amount: ${amount}`);
			if (Number.isInteger(amount)) { //	Make sure it is an int
				if (amount < 0) { //	Can't ask for negative money
					bot.createMessage(channel.id, "I can't give you negative money");
					return;
				} else if (amount > 10000) {
					bot.createMessage(channel.id, "Hell no, you ain't getting that much");
					return;
				} else {
					db.serialize(() => {
						//	Update cash/debt
						db.run(`UPDATE users SET cash = cash + ${amount}, debt = debt + ${amount} WHERE userID = ${member.user.id}`, function (err) {
							if (err)
								console.log(`error updating table: ${err.message}`);
						});
					});
					bot.createMessage(channel.id, `Alright, here's \$${amount}.`);
					return;
				}
				// more stuff
			}
			break;
	}
}
exports.borrow = borrow;
// 	Repay debt

async function repay(channel, member, args) {
	switch (args[0]) {
		case undefined:
			bot.createMessage(channel.id, "You gotta say how much you're paying \n Syntax: .repay <amount>");
			break;
		default:
			var amount = parseInt(args[0]);
			if (debug)
				console.log(`amount: ${amount}`);
			if (Number.isInteger(amount)) { //	Make sure they're giving a valid number
				if (amount < 0) { //	Can't give negative money
					bot.createMessage(channel.id, "Hell naw");
					return;
				} else {
					db.serialize(() => {
						db.get(`SELECT cash cash, debt debt FROM users WHERE userID = ${member.user.id}`, (err, row) => {
							if (err) {
								if (debug)
									console.log(`error querying table: ${err.message}`);
							} else {
								// 	Don't let them overpay
								if (amount > row.debt) {
									bot.createMessage(channel.id, `Your debt is only \$${row.debt}`);
									return;
								}

								//	Can't spend more money than they have
								else if (amount > row.cash) {
									bot.createMessage(channel.id, `You only have \$${row.cash}`);
									return;
								}
								else {
									//	If they don't return by now, update cash/debt
									db.run(`UPDATE users SET cash = cash - ${amount}, debt = debt - ${amount} WHERE userID = ${member.user.id}`, function (err) {
										if (err)
											console.log(`error updating table: ${err.message}`);
									});
									bot.createMessage(channel.id, `You paid off \$${amount}.`);
									return;
								}
							}
						});
					});
				}
			}
			break;
	}
}
exports.repay = repay;
