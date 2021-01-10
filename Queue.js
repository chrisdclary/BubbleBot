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
	append(node) {
		if (this.size == 0) {
			this.head = node;
			this.tail = node;
		} else {
			this.tail.next = node;
			this.tail = node;
		}
		this.size++;
	}
	pop() {
		if (this.size == 0) {
			// Do nothing
		} else {
			this.head = this.head.next;
			this.size -= 1;
			if (this.size == 0) {
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
exports.Queue = Queue;
