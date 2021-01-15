/***
 * connection.js
 * 
 * Houses objects for the bot and database
 */


var auth = require('./auth.json');
var Eris = require('eris');

const bot = new Eris(auth.token);

const sqlite3 = require('sqlite3').verbose();
//	Open database connection
let db = new sqlite3.Database('./db/users.db', (err) => {
	if (err)
		console.log(err.message);
});

exports.db = db;

exports.bot = bot;
