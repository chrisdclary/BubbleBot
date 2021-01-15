/**
 * global.js
 * 
 * Houses global variables that need to be accessed by
 *  modules, such as debug flag and the busyList
 */


//	Flag for debug mode. Use .debug to toggle
var debug = 1;
//	Keeps track of busy channels
var busyList = [];

function busyPop(channel) {
	let pos = busyList.indexOf(channel.id);
	busyList.splice(pos, 1);
}
exports.busyPop = busyPop;

exports.busyList = busyList;
exports.debug = debug;
