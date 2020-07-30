import normalize from '../libs/remove-whitespace.js';

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

class Searcher {
	constructor() {
		this._div = document.createElement('div');
	}

	matches(message, searchTerm) {
		const normalizedSearchTerm = normalize(searchTerm.trim().toLowerCase());
		const content = message.data.content;
		this._div.innerHTML = content;
		const textContent = this._div.textContent || this._div.innerText || '';
		const normalizedContent = normalize(textContent.trim().toLowerCase());
		return normalizedContent.includes(normalizedSearchTerm);
	}
}

export default class LogSearch extends Application {
	CONFIG = {
		SEARCH_BATCH_SIZE: 25
	};

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

		this._page = 1;

		this._totalPage = -1;

		this._searcher = new Searcher();

		this._mode = 'newest';
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

		html.on('click', '.paginator.prev', () => {
			this._page = Math.max(0, this._page - 1);
			this.renderResultPage(this._page, this.CONFIG.SEARCH_BATCH_SIZE);
		});

		html.on('click', '.paginator.next', () => {
			this._page = Math.min(this._totalPage, this._page + 1);
			this.renderResultPage(this._page, this.CONFIG.SEARCH_BATCH_SIZE);
		});

		html.on('click', '.controls .sort button', (event) => {
			const sortMode = $(event.target).attr('data-sort');
			this.changeSortMode(sortMode);
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

	changeSortMode(newMode) {
		if (newMode !== this._mode) {
			this._mode = newMode;
			this._page = 1;
			this.results = this._sortResults(this._mode);
			this.renderResultPage(this._page, this.CONFIG.SEARCH_BATCH_SIZE);
			this._element.find('.sort button').removeClass('selected');
			this._element.find(`.sort button[data-sort=${newMode}]`).addClass('selected');
		}
	}

	async searchInput(searchTerm) {
		if (searchTerm) {
			if (searchTerm != this._lastSearchTerm) {
				const messages = game.messages.entities;
				this._lastSearchTerm = searchTerm;
				// this.results = messages.filter((m) => m.data.content.toLowerCase().includes(searchTerm));
				this.results = [];
				for (let i = 0; i < messages.length; i++) {
					if (this._searcher.matches(messages[i], searchTerm)) {
						this.results.push(
							new SearchResult({
								message: messages[i],
								prev: i > 0 ? messages[i - 1] : undefined,
								next: i < messages.length - 1 ? messages[i + 1] : undefined
							})
						);
					}
				}
				this.results = this._sortResults(this._mode);
				this._page = 1;
				this._totalPage = Math.ceil(this.results.length / this.CONFIG.SEARCH_BATCH_SIZE);
				await this.renderSearchResults(this._page, this.CONFIG.SEARCH_BATCH_SIZE);
			} else if (this._page > 1) {
				this._page = 1;
				await this.renderSearchResults(this._page, this.CONFIG.SEARCH_BATCH_SIZE);
			}
		}
	}

	_sortResults(mode) {
		if (mode === 'newest') {
			return this.results.sort((a, b) => b.message.data.timestamp - a.message.data.timestamp);
		} else if (mode === 'oldest') {
			return this.results.sort((a, b) => a.message.data.timestamp - b.message.data.timestamp);
		}
		return this.results;
	}

	async renderSearchResults(page, pageSize) {
		this.renderResultPage(page, pageSize);
		if (this.results.length > 0) {
			this._showCloseControl();
		} else {
			this._showSearchControl();
		}
		this.renderControls();
	}

	renderControls() {
		const controls = this._element.find('.controls');
		const resultCount = controls.find('.result-count');
		const sort = controls.find('.sort');
		const length = this.results.length;
		controls.removeClass('none');
		if (length > 0) {
			controls.addClass('active');
			let count = `${length} Results`;
			if (length === 1) {
				count = '1 Result';
			}
			resultCount.html(count);
		} else {
			controls.removeClass('active');
			resultCount.html('No results.');
		}
	}

	async _renderPagination() {
		const pagination = $('<div class="pagination"></div>');
		if (this._totalPage > 1) {
			pagination.append($('<button class="paginator prev"><i class="fas fa-angle-left"></i></button>'));
			pagination.append($(`<div class="page-info">Page ${this._page} of ${this._totalPage}</div>`));
			pagination.append($('<button class="paginator next"><i class="fas fa-angle-right"></i></button>'));
			pagination.removeClass('none');
			this._updatePagination(pagination);
		} else {
			pagination.addClass('none');
		}
		return pagination;
	}

	async _updatePagination(pagination) {
		const canGoBack = this._page > 1;
		const canGoForward = this._page < this._totalPage;
		if (!canGoBack) {
			pagination.find('.paginator.prev').attr('disabled', true).addClass('disabled');
		}
		if (!canGoForward) {
			pagination.find('.paginator.next').attr('disabled', true).addClass('disabled');
		}
	}

	async renderResultPage(page, pageSize) {
		const searchResults = this._element.find('.results');
		const html = [];
		const paginatedResults = this._paginateResults(page, pageSize);
		for (const result of paginatedResults) {
			const node = await this._renderOneResult(result);
			html.push(node);
		}
		searchResults.html(html);
		searchResults.append(await this._renderPagination());
		setTimeout(() => {
			searchResults.scrollTop(0);
		}, 0);
	}

	_paginateResults(page, pageSize) {
		const start = (page - 1) * pageSize;
		const end = start + pageSize - 1;
		return this.results.slice(start, end);
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
		this._element.find('.pagination').empty();
		this._element.find('#search-input').val('');
		this._showSearchControl();
		this._element.find('.controls').addClass('none');
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
			// const scrollTop = msg.offsetTop - $chatLog[0].clientHeight / 2 - msg.clientHeight;
			const scrollTop = msg.offsetTop - $chatLog[0].clientHeight / 2 + msg.clientHeight / 2;
			$chatLog.scrollTop(scrollTop);
		}
	}

	_highlight(message) {
		message.addClass('highlight');
		setTimeout(() => message.removeClass('highlight'), 2000);
	}
}
