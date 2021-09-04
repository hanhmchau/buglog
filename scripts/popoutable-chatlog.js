import throttle from '../libs/lodash-throttle.js';
import LogSearch from './logsearch.js';

export default class PopoutableChatLog extends ChatLog {
	constructor(options) {
		super(options);
		this._lastScrollTop = Number.MAX_SAFE_INTEGER;
		this._topmostId = null;
		this._bottommostId = null;
		this._logsearch = null;
		this._open = false;
		this._throttledOnScrollLog = throttle(super._onScrollLog, 500);
	}

	setTopmostId(id) {
		this._topmostId = id;
	}

	setBottommostId(id) {
		this._bottommostId = id;
	}

	/** @override */
	renderPopout(original) {
		const pop = super.createPopout();
		pop.render(true);
	}

	async renderSearchControls(element) {
		const search = $('<a class="search"><i class="fas fa-search"></i>Search</a>');
		$(element).find('header .window-title').after(search);
		this._logsearch = new LogSearch(this);
		const html = await this._logsearch.render();
		$(element).prepend(html);
		this._activatePopoutListeners(element);
	}

	_activatePopoutListeners(element) {
		const $element = $(element);
		$element.find('.search').click(() => {
			this.showSearch();
		});
		$element.find('.window-content').on('click', (event) => {
			const isLogsearch = $(event.target).closest('#logsearch').length > 0;
			if (!this._logsearch.collapsed && !isLogsearch) {
				this.hideSearch();
			}
		});
		$element.find('header').on('dblclick', () => {
			this.hideSearch();
		});
	}

	showSearch() {
		if (this._logsearch) {
			this._logsearch.show();
		}
	}

	hideSearch() {
		if (this._logsearch) {
			this._logsearch.hide();
		}
	}

	async _renderBatchUp(log, size) {
		const messages = game.messages.entities.filter((m) => m.visible);
		const topmostIndex = messages.findIndex((m) => m.id === this._topmostId);
		if (topmostIndex > 0) {
			const newTopmostIndex = Math.max(0, topmostIndex - size);
			const batch = await this._renderBatchHelper(messages, newTopmostIndex, topmostIndex);
			this._topmostId = messages[newTopmostIndex].id;
			$(log).prepend(batch);
		}
	}

	async _renderBatchDown(log, size) {
		const messages = game.messages.entities.filter((m) => m.visible);
		const bottommostIndex = messages.findIndex((m) => m.id === this._bottommostId);
		if (bottommostIndex < messages.length - 1) {
			const newBottommostIndex = Math.min(bottommostIndex + size, messages.length - 1);
			const batch = await this._renderBatchHelper(messages, bottommostIndex + 1, newBottommostIndex + 1);
			this._bottommostId = messages[newBottommostIndex].id;
			$(log).append(batch);
		}
	}

	async _renderBatchHelper(messages, start, end) {
		const batch = messages.slice(start, end);
		const html = [];
		for (const msg of batch) {
			html.push(await msg.render());
		}
		return html;
	}

	registerMessageRange() {
		const lastBatch = game.messages.entities.slice(-CONFIG.ChatMessage.batchSize).filter((m) => m.visible);
		this._bottommostId = lastBatch[lastBatch.length - 1].id;
		this._topmostId = lastBatch[0].id;
	}

	async onScrollPopoutLog(event) {
		if (!this.rendered) return;
		this._state = Application.RENDER_STATES.RENDERING;
		const log = event.target;
		const isScrollingDown = log.scrollTop > this._lastScrollTop;
		this._lastScrollTop = log.scrollTop;
		if (log.scrollTop / log.scrollHeight < 0.05 && !isScrollingDown) {
			await this._renderBatchUp(log, CONFIG.ChatMessage.batchSize);
		} else if (log.scrollTop >= log.scrollHeight - log.offsetHeight - 50 && isScrollingDown) {
			await this._renderBatchDown(log, CONFIG.ChatMessage.batchSize);
		}
		// Restore the rendered state
		this._state = Application.RENDER_STATES.RENDERED;
	}

	_getEntryContextOptions(args) {
		return [
			...super._getEntryContextOptions(args),
			{
				name: 'Delete',
				icon: '<i class="fas fa-trash"></i>',
				callback: (header) => {
					const chatData = ui.chat.collection.get($(header).attr('data-message-id'));
					new Dialog({
						title: `Delete Message`,
						content: `
							<div id="preview-delete-dialog">
								<h4 class="dialog-prompt">Are you sure you want to delete this message?</h4>
								<div id="chat-log" 
								class="preview-delete"
									style="
										height: ${header[0].offsetHeight}px;
								">
								${header[0].outerHTML}
								</div> 
							</div>
						   `,
						buttons: {
							deletemsg: {
								label: `Delete`,
								callback: () => chatData.delete()
							},
							cancel: {
								label: 'Cancel'
							}
						}
					}).render(true);
				}
			}
		];
	}

	_contextMenu(html) {
		// Entry Context
		const entryOptions = this._getEntryContextOptions();
		Hooks.call(`get${this.constructor.name}EntryContext`, html, entryOptions);
		if (entryOptions) new ContextMenu(html, '.message', entryOptions);
	}
}
