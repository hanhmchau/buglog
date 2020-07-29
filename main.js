'use strict';
import PopoutableChatLog from './scripts/popoutable-chatlog.js';
import BugLog from './scripts/buglog.js';
import inherits from './libs/util-inherits.js';

class BugModuleConfig {
	static init() {
		if (game.modules.get('chat-scrolling') && game.modules.get('chat-scrolling').active) {
			inherits(PopoutableChatLog, ScrollableChatLog);
		}
	}
}

Hooks.once('init', () => {
	BugModuleConfig.init();
	CONFIG.ui.chat = PopoutableChatLog;
	BugLog.init();
});

Hooks.once('ready', () => {
	loadTemplates(['modules/buglog/templates/log_search.hbs']);
	BugLog.attachPopoutToChatTabControl();
});

Hooks.on('renderPopoutableChatLog', async (obj, html, data) => {
	await BugLog.renderPopout();
	Hooks.call('renderSidebarTab', obj, html, data);
	Hooks.call('renderScrollableChatLog', obj, html, data);
});

Hooks.on('closeScrollableChatLog', async (obj, html, data) => {
	BugLog.closePopout();
});
