import throttle from '../libs/lodash-throttle.js';
import Nanobar from '../libs/nanobar.js';

export default class BugLog {
	constructor(...args) {
		this._openPopout = false;
	}

	static init() {
		$(document).on('keydown', (event) => {
			const popout = this._popout;
			if (popout && this._openPopout) {
				if (event.ctrlKey && event.key === 'f') {
					this._popout.showSearch();
					event.preventDefault();
				}
			}
		});
	}

	static attachPopoutToChatTabControl() {
		const sidebarTabs = document.getElementById('sidebar-tabs');
		if (sidebarTabs) {
			sidebarTabs.querySelector('[data-tab=chat]').addEventListener('contextmenu', () => this._createChatPopout());
		}
	}

	static _createChatPopout() {
		const chatTab = ui['chat'];
		if (chatTab) {
			chatTab.renderPopout(chatTab);
		}
	}

	static closePopout() {
		this._openPopout = false;
	}

	static renderPopout() {
		const popout = ui['chat']._popout;
		if (popout) {
			this._popout = popout;
			this._openPopout = true;
			const element = popout.element[0];
			if (element) {
				setTimeout(() => {
					this._formatPopout(popout, element);
					this._loadPaginatedLogs(popout, element);
					// this._loadAllLogs(popout, element);
				}, 0);
			}
		}
	}

	static _formatPopout(popout, element) {
		this._removeChatControls(element);
		this._addSizeControls(popout, element);
		this._maximizePopout(popout, element);
	}

	static sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	static _loadPaginatedLogs(popout, element) {
		const $chatLog = $(element).find('#chat-log');
		this._attachPopoutLogListeners(popout, $chatLog);
		popout.renderSearchControls(element);
		popout.registerMessageRange();
	}

	static async _loadAllLogs(popout, element) {
		let messages = game.messages.entities.filter((m) => m.visible);
		const $chatLog = $(element).find('#chat-log');
		$chatLog.empty();
		const nanobar = new Nanobar({
			target: element.querySelector('#chat')
		});
		let progress = 0;

		const batchSize = 100;
		const waitTime = 300;

		/** TEST */
		const desiredLength = 3000;
		const requiredTimes = Math.ceil(desiredLength / messages.length);
		messages = new Array(requiredTimes).fill(messages).flat();
		messages = messages.slice(0, desiredLength);
		/** END TEST */

		let html = [];
		for (let i = 0; i < messages.length; i++) {
			html.push(await messages[i].render());
			if (i > 0 && i % batchSize === 0) {
				$chatLog.append(html);
				html = [];
				progress += batchSize;
				if ((i % batchSize) * 5 === 0) {
					nanobar.go((progress / messages.length) * 100);
				}
				await this.sleep(waitTime);
			}
		}
		nanobar.go(100);
		popout.scrollBottom();
		$chatLog.off('scroll');
	}

	static _attachPopoutLogListeners(popout, $chatLog) {
		//const debouncedScrollPopoutLog = debounce(popout.onScrollPopoutLog, 50);
		//$chatLog.off('scroll').on('scroll', (event) => debouncedScrollPopoutLog.call(popout, event));
		const throttledScrollPopoutLog = throttle(popout.onScrollPopoutLog, 150);
		$chatLog.off('scroll').on('scroll', (event) => throttledScrollPopoutLog.call(popout, event));
	}

	static _addSizeControls(popout, element) {
		const maximizeButtonStr = '<a class="maximize"><i class="fas fa-window-maximize"></i>Maximize</a>';
		const mediumSizeButtonStr = '<a class="mediumize"><i class="fas fa-window-restore"></i>Cinema mode</a>';
		$(element)
			.find('header .close')
			.before(mediumSizeButtonStr + maximizeButtonStr);
		$(element)
			.find('.maximize')
			.on('click', () => this._maximizePopout(popout, element));
		$(element)
			.find('.mediumize')
			.on('click', () => this._mediumSizePopout(popout, element));
	}

	static _removeChatControls(element) {
		element.querySelector('#chat-controls').remove();
		element.querySelector('#chat-form').remove();
	}

	static _maximizePopout(popout, element) {
		popout.setPosition({
			left: 0,
			top: 0,
			height: window.innerHeight,
			width: window.innerWidth
		});
		$(element).removeClass('mediumized').addClass('maximized');
	}

	// If this function is called immediately after opening the popout, it's bugged out.
	static _mediumSizePopout(popout, element) {
		const sidebar = document.getElementById('sidebar');
		const players = document.getElementById('players');
		const margin = 10;
		// has to be separate, otherwise it won't work
		// (see how top value is reset while setting height in setPosition() in Foundry.js)
		popout.setPosition({
			height: window.innerHeight - players.offsetHeight - margin,
			width: window.innerWidth - sidebar.offsetWidth - margin
		});
		popout.setPosition({
			top: 0,
			left: 0
		});
		$(element).removeClass('maximized').addClass('mediumized');
	}
}