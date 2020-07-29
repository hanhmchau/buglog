class SearchResult {
	constructor({ message, prev, next }) {
		this.message = message;
		this.prev = prev;
		this.next = next;
	}
	forceLeading() {
		this._setLeading(true);
	}
	unforceLeading() {
		this._setLeading(false);
	}
	_setLeading(force) {
		this.message.data.forceLeading = force;
		if (this.prev) {
			this.prev.data.forceLeading = force;
		}
		if (this.next) {
			this.next.data.forceLeading = force;
		}
	}
}

export default class LogSearch extends Application {
	constructor(popout, ...args) {
		super(...args);

		/**
		 * Search results
		 * @type {Array}
		 */
		this.results = [];

		/**
		 * Track whether the search result container is currently collapsed
		 * @type {Boolean}
		 */
		this._collapsed = false;

		this._lastSearchTerm = undefined;

		this._element = undefined;

		this._popout = popout;
	}

	get collapsed() {
		return this._collapsed;
	}

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			baseApplication: 'LogSearch'
		});
	}

	/** @override */
	getData(options) {
		return {
			results: this.results,
			collapsed: this._collapsed
		};
	}

	/** @override */
	async render() {
		const template = 'modules/buglog/templates/log_search.hbs';
		const html = await renderTemplate(template);
		const $html = $(html);
		this.activateListeners($html);
		this._element = $html;
		return $html;
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		html.on('click', '.jump', (event) => {
			const id = $(event.currentTarget).attr('data-message-id');
			this.jump(id);
		});

		html.find('#search-input').on('keyup', (event) => {
			if (event.key === 'Enter') {
				const searchTerm = event.target.value.trim().toLowerCase();
				this.searchInput(searchTerm);
			}
		});

		html.find('.search-button').on('click', (event) => {
			const searchTerm = $(event.target).closest('.search-container').find('#search-input').val().trim().toLowerCase();
			this.searchInput(searchTerm);
		});

		html.find('.close-button').on('click', () => {
			this.clearSearch();
		});
	}

	hide() {
		if (this._element) {
			setTimeout(() => {
				this._collapsed = true;
				this._element.addClass('none');
				this.clearSearch();
			}, 0);
		}
	}

	show() {
		if (this._element) {
			setTimeout(() => {
				this._element.removeClass('none');
				this._collapsed = false;
				this._element.find('#search-input').focus();
			}, 0);
		}
	}

	async searchInput(searchTerm) {
		if (searchTerm && searchTerm != this._lastSearchTerm) {
			const messages = game.messages.entities;
			this._lastSearchTerm = searchTerm;
			// this.results = messages.filter((m) => m.data.content.toLowerCase().includes(searchTerm));
			this.results = [];
			for (let i = 0; i < messages.length; i++) {
				if (messages[i].data.content.toLowerCase().includes(searchTerm)) {
					this.results.push(
						new SearchResult({
							message: messages[i],
							prev: i > 0 ? messages[i - 1] : undefined,
							next: i < messages.length - 1 ? messages[i + 1] : undefined
						})
					);
				}
			}
			await this.renderSearchResults();
		}
	}

	async renderSearchResults() {
		const searchResults = this._element.find('.results');
		const html = [];
		for (const result of this.results) {
			const node = await this._renderOneResult(result);
			html.push(node);
		}
		searchResults.html(html);
		if (this.results.length > 0) {
			this._showCloseControl();
		} else {
			this._showSearchControl();
		}
	}

	async _showSearchControl() {
		this._element.find('.close-button').addClass('none');
		this._element.find('.search-button').removeClass('none');
	}

	async _showCloseControl() {
		this._element.find('.close-button').removeClass('none');
		this._element.find('.search-button').addClass('none');
	}

	async clearSearch() {
		this.results = [];
		this._lastSearchTerm = undefined;
		this._element.find('.results').empty();
		this._element.find('#search-input').val('');
		this._showSearchControl();
	}

	async _renderOneResult(result) {
		result.forceLeading();
		const resultHTML = [];
		if (result.prev) {
			const $msgPrev = await result.prev.render();
			$msgPrev.addClass('prev');
			resultHTML.push($msgPrev);
		}
		const $msg = await result.message.render();
		$msg.addClass(['middle']);
		resultHTML.push($msg);
		if (result.next) {
			const $msgNext = await result.next.render();
			$msgNext.addClass('next');
			resultHTML.push($msgNext);
		}
		const node = $('<div class="result"></div>');
		node.append(resultHTML);
		setTimeout(() => {
			$msg.append($(`<button class="jump" data-message-id=${result.message.id}>Jump</button>`));
			result.unforceLeading();
		}, 50);
		return node;
	}

	async jump(id) {
		const foundMessage = game.messages.get(id);
		const renderMessages = this._getMessagesCenteredIn(foundMessage);
		this._popout.setTopmostId(renderMessages[0].id);
		this._popout.setBottommostId(renderMessages[renderMessages.length - 1].id);
		await this._renderBatch(renderMessages, foundMessage);
	}

	_getMessagesCenteredIn(foundMessage) {
		const messages = game.messages.entities.filter((m) => m.visible);
		const index = messages.indexOf(foundMessage);
		const lowerBound = Math.max(0, index - Math.floor(CONFIG.ChatMessage.batchSize / 2));
		const upperBound = Math.min(messages.length, index + Math.floor(CONFIG.ChatMessage.batchSize / 2));
		return messages.slice(lowerBound, upperBound);
	}

	async _renderBatch(messages, scrollTargetMessage) {
		const $chatLog = $('#chat-popout').find('#chat-log');

		const html = [];
		for (const msg of messages) {
			html.push(await msg.render());
		}
		setTimeout(() => {
			$chatLog.html(html);
			const target = $chatLog.find(`[data-message-id=${scrollTargetMessage.id}]`);
			if (scrollTargetMessage) this._scrollTo($chatLog, target);
			this._highlight(target);
		}, 100);
	}

	async _scrollTo($chatLog, target) {
		if (target.length) {
			const msg = target[0];
			const scrollTop = msg.offsetTop - $chatLog[0].clientHeight / 2 - msg.clientHeight;
			$chatLog.scrollTop(scrollTop);
		}
	}

	_highlight(message) {
		message.addClass('highlight');
		setTimeout(() => message.removeClass('highlight'), 2000);
	}
}